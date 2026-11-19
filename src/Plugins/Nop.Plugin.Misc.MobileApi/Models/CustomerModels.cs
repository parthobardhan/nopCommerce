namespace Nop.Plugin.Misc.MobileApi.Models;

public record LoginRequest
{
    public string Email { get; init; }
    public string Password { get; init; }
}

public record RegisterRequest
{
    public string Email { get; init; }
    public string Password { get; init; }
    public string FirstName { get; init; }
    public string LastName { get; init; }
}

public record CustomerDto
{
    public int Id { get; init; }
    public string Email { get; init; }
    public string FirstName { get; init; }
    public string LastName { get; init; }
    public bool IsGuest { get; init; }
}

public record SessionDto
{
    public string Token { get; init; }
    public CustomerDto Customer { get; init; }
}

public record AuthResultDto
{
    public bool Success { get; init; }
    public IList<string> Errors { get; init; } = new List<string>();
    public SessionDto Session { get; init; }
}
