---
name: add-widget-plugin
description: Scaffolds a nopCommerce IWidgetPlugin that injects Razor into a public widget zone. Use when adding a storefront banner, checkout message, or any new Widgets.* plugin without editing core checkout or catalog controllers.
---

# Add a widget plugin

Scaffold under `src/Plugins/Nop.Plugin.Widgets.{Name}/`. Do not edit `CheckoutController`, `ProductController`, or `Nop.Services`.

## Clone these, in order

1. `src/Plugins/Nop.Plugin.Widgets.Jotform/` — `IWidgetPlugin` + view component
2. `src/Plugins/Nop.Plugin.Widgets.Swiper/Notes.txt` — csproj output path
3. Zone constants in `src/Presentation/Nop.Web.Framework/Infrastructure/PublicWidgetZones.cs`

`Completed.cshtml` already invokes `CheckoutCompletedTop` / `CheckoutCompletedBottom`. Hook those. Do not edit the view unless the zone is missing.

## Minimum files

| File | Role |
|------|------|
| `plugin.json` | `Group: Widgets`, `SystemName: Widgets.{Name}`, `FileName: Nop.Plugin.Widgets.{Name}.dll`, `SupportedVersions: ["5.00"]` |
| `Nop.Plugin.Widgets.{Name}.csproj` | `net10.0`, output `Presentation/Nop.Web/Plugins/Widgets.{Name}` |
| `{Name}Plugin.cs` | `BasePlugin`, `IWidgetPlugin` |
| `Components/Widget{Name}ViewComponent.cs` | `NopViewComponent`, encode all output |
| `Views/PublicInfo.cshtml` | Banner markup |
| `{Name}Settings.cs` | Banner text; persist via `ISettingService` in `InstallAsync` |

## Weekend Sale defaults (demo)

- Zone: `PublicWidgetZones.CheckoutCompletedTop`
- Copy: `Thanks — use code WEEKEND10 on your next order.`
- Friendly name: `Weekend Sale banner`

## After scaffolding

1. Add the project to `src/NopCommerce.sln` if it is not picked up.
2. Tell the user to rebuild `Nop.Web` and enable the plugin in Admin → Configuration → Local plugins.
3. Do not run the install wizard or touch `App_Data/appsettings.json`.
