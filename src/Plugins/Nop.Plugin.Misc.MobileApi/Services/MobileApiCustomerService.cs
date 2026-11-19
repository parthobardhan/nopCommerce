using Nop.Core;
using Nop.Core.Domain.Customers;
using Nop.Core.Events;
using Nop.Plugin.Misc.MobileApi.Models;
using Nop.Services.Customers;
using Nop.Services.Localization;
using Nop.Services.Logging;
using Nop.Services.Messages;
using Nop.Services.Orders;

namespace Nop.Plugin.Misc.MobileApi.Services;

public interface IMobileApiCustomerService
{
    /// <summary>
    /// Create a new guest customer with an access token
    /// </summary>
    Task<SessionDto> CreateGuestSessionAsync();

    Task<CustomerDto> PrepareCustomerAsync(Customer customer);

    /// <summary>
    /// Log in; the cart of the current (guest) customer is migrated to the logged in customer and the current token is revoked
    /// </summary>
    Task<AuthResultDto> LoginAsync(Customer currentCustomer, string currentToken, LoginRequest request);

    /// <summary>
    /// Register the current guest customer
    /// </summary>
    Task<AuthResultDto> RegisterAsync(Customer currentCustomer, string currentToken, RegisterRequest request);

    Task LogoutAsync(string currentToken);
}

public class MobileApiCustomerService : IMobileApiCustomerService
{
    protected readonly CustomerSettings _customerSettings;
    protected readonly ICustomerActivityService _customerActivityService;
    protected readonly ICustomerRegistrationService _customerRegistrationService;
    protected readonly ICustomerService _customerService;
    protected readonly IEventPublisher _eventPublisher;
    protected readonly ILocalizationService _localizationService;
    protected readonly IMobileApiTokenService _tokenService;
    protected readonly IShoppingCartService _shoppingCartService;
    protected readonly IStoreContext _storeContext;
    protected readonly IWorkContext _workContext;
    protected readonly IWorkflowMessageService _workflowMessageService;

    public MobileApiCustomerService(CustomerSettings customerSettings,
        ICustomerActivityService customerActivityService,
        ICustomerRegistrationService customerRegistrationService,
        ICustomerService customerService,
        IEventPublisher eventPublisher,
        ILocalizationService localizationService,
        IMobileApiTokenService tokenService,
        IShoppingCartService shoppingCartService,
        IStoreContext storeContext,
        IWorkContext workContext,
        IWorkflowMessageService workflowMessageService)
    {
        _customerSettings = customerSettings;
        _customerActivityService = customerActivityService;
        _customerRegistrationService = customerRegistrationService;
        _customerService = customerService;
        _eventPublisher = eventPublisher;
        _localizationService = localizationService;
        _tokenService = tokenService;
        _shoppingCartService = shoppingCartService;
        _storeContext = storeContext;
        _workContext = workContext;
        _workflowMessageService = workflowMessageService;
    }

    protected static AuthResultDto Fail(params string[] errors)
    {
        return new AuthResultDto { Success = false, Errors = errors.ToList() };
    }

    public virtual async Task<SessionDto> CreateGuestSessionAsync()
    {
        var customer = await _customerService.InsertGuestCustomerAsync();
        var store = await _storeContext.GetCurrentStoreAsync();
        customer.RegisteredInStoreId = store.Id;
        await _customerService.UpdateCustomerAsync(customer);

        return new SessionDto
        {
            Token = await _tokenService.IssueTokenAsync(customer),
            Customer = await PrepareCustomerAsync(customer)
        };
    }

    public virtual async Task<CustomerDto> PrepareCustomerAsync(Customer customer)
    {
        return new CustomerDto
        {
            Id = customer.Id,
            Email = customer.Email,
            FirstName = customer.FirstName,
            LastName = customer.LastName,
            IsGuest = !await _customerService.IsRegisteredAsync(customer)
        };
    }

    public virtual async Task<AuthResultDto> LoginAsync(Customer currentCustomer, string currentToken, LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Email) || string.IsNullOrEmpty(request.Password))
            return Fail("Email and password are required");

        var email = request.Email.Trim();
        var loginResult = await _customerRegistrationService.ValidateCustomerAsync(email, request.Password);
        if (loginResult != CustomerLoginResults.Successful)
        {
            var resource = loginResult switch
            {
                CustomerLoginResults.CustomerNotExist => "Account.Login.WrongCredentials.CustomerNotExist",
                CustomerLoginResults.Deleted => "Account.Login.WrongCredentials.Deleted",
                CustomerLoginResults.NotActive => "Account.Login.WrongCredentials.NotActive",
                CustomerLoginResults.NotRegistered => "Account.Login.WrongCredentials.NotRegistered",
                CustomerLoginResults.LockedOut => "Account.Login.WrongCredentials.LockedOut",
                _ => "Account.Login.WrongCredentials"
            };

            return Fail(await _localizationService.GetResourceAsync(resource));
        }

        var customer = await _customerService.GetCustomerByEmailAsync(email);

        if (currentCustomer != null && currentCustomer.Id != customer.Id)
        {
            await _shoppingCartService.MigrateShoppingCartAsync(currentCustomer, customer, true);
            await _tokenService.RevokeTokenAsync(currentToken);
        }

        await _workContext.SetCurrentCustomerAsync(customer);

        var guestCustomer = currentCustomer != null && currentCustomer.Id != customer.Id && await _customerService.IsGuestAsync(currentCustomer)
            ? currentCustomer
            : null;
        await _eventPublisher.PublishAsync(new CustomerLoggedinEvent(customer, guestCustomer));
        await _customerActivityService.InsertActivityAsync(customer, "PublicStore.SuccessfulLogin",
            await _localizationService.GetResourceAsync("ActivityLog.PublicStore.Login.Success"), customer);

        return new AuthResultDto
        {
            Success = true,
            Session = new SessionDto
            {
                Token = await _tokenService.IssueTokenAsync(customer),
                Customer = await PrepareCustomerAsync(customer)
            }
        };
    }

    public virtual async Task<AuthResultDto> RegisterAsync(Customer currentCustomer, string currentToken, RegisterRequest request)
    {
        ArgumentNullException.ThrowIfNull(currentCustomer);

        if (_customerSettings.UserRegistrationType == UserRegistrationType.Disabled)
            return Fail(await _localizationService.GetResourceAsync("Account.Register.Result.Disabled"));

        if (await _customerService.IsRegisteredAsync(currentCustomer))
            return Fail(await _localizationService.GetResourceAsync("Account.Register.Errors.AlreadyRegistered"));

        if (string.IsNullOrWhiteSpace(request?.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            return Fail("First and last name are required");

        var email = request.Email?.Trim();
        var store = await _storeContext.GetCurrentStoreAsync();
        var isApproved = _customerSettings.UserRegistrationType == UserRegistrationType.Standard;
        var registrationRequest = new CustomerRegistrationRequest(currentCustomer, email, email,
            request.Password, _customerSettings.DefaultPasswordFormat, store.Id, isApproved);

        var result = await _customerRegistrationService.RegisterCustomerAsync(registrationRequest);
        if (!result.Success)
            return new AuthResultDto { Success = false, Errors = result.Errors };

        currentCustomer.FirstName = request.FirstName.Trim();
        currentCustomer.LastName = request.LastName.Trim();
        await _customerService.UpdateCustomerAsync(currentCustomer);

        await _eventPublisher.PublishAsync(new CustomerRegisteredEvent(currentCustomer));

        var language = await _workContext.GetWorkingLanguageAsync();
        if (!isApproved)
        {
            await _tokenService.RevokeTokenAsync(currentToken);
            return new AuthResultDto
            {
                Success = true,
                Errors = new List<string> { await _localizationService.GetResourceAsync(
                    _customerSettings.UserRegistrationType == UserRegistrationType.EmailValidation
                        ? "Account.Register.Result.EmailValidation"
                        : "Account.Register.Result.AdminApproval") }
            };
        }

        await _workflowMessageService.SendCustomerWelcomeMessageAsync(currentCustomer, language.Id);
        await _eventPublisher.PublishAsync(new CustomerActivatedEvent(currentCustomer));

        return new AuthResultDto
        {
            Success = true,
            Session = new SessionDto
            {
                Token = currentToken,
                Customer = await PrepareCustomerAsync(currentCustomer)
            }
        };
    }

    public virtual async Task LogoutAsync(string currentToken)
    {
        await _tokenService.RevokeTokenAsync(currentToken);
    }
}
