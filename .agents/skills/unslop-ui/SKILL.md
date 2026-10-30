---
name: unslop-ui
description: Design standards for a restrained, clear, usable marketplace interface.
allowed-tools: Read Grep Glob Bash Edit Write
effort: high
---

# Maua Marketplace UI design standards

Use these rules for all new and revised user-facing UI in this repository.

- Keep the marketplace's existing forest-green, warm-yellow and neutral-paper identity. Do not replace it with a generic SaaS palette.
- Prioritize product photography, product titles, prices, condition and location. Product cards should help people compare items quickly.
- Use neutral space and typography for hierarchy. Avoid decorative icon tiles, emoji decoration, gradient panels, glass effects and glowing shadows.
- Use flat, solid controls with consistent 4px geometry. Reserve yellow for price labels and important secondary actions; green for primary actions and navigation.
- Keep forms calm and practical: visible labels, readable help text, consistent input sizes, clear validation and no unnecessary nested cards.
- Keep mobile layouts one-handed and content-first. Preserve the bottom navigation and make search, categories, listing cards and forms easy to use on narrow screens.
- Keep the app light-mode only. Ensure chat and account screens remain readable when the device requests dark mode.
- Preserve all existing behavior, routes, content, Supabase integrations, Google authentication, Cloudflare storage, notifications, chat, wishlist, PWA and APK download/update flows.
- Avoid entrance animations. Keep only brief interaction feedback and honor reduced-motion preferences.
- Before committing, check type safety, build output, responsive behavior, keyboard focus, and that every existing route and action remains wired.
