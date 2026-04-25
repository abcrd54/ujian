---
name: Academic Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#424754'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#924700'
  on-tertiary: '#ffffff'
  tertiary-container: '#b75b00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  button:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-page: 40px
---

## Brand & Style
The design system is anchored in a **Corporate/Modern** aesthetic tailored for the high-stakes world of education technology. The brand personality is authoritative yet accessible, evoking a sense of institutional trust through rigorous alignment and intentional whitespace. 

The target audience includes educators and administrators who require a tool that feels like a reliable extension of their classroom. To achieve this, the UI employs a "Reduced Cognitive Load" philosophy—minimizing visual noise to ensure the educational content remains the focal point. Surfaces are layered using soft depth markers rather than harsh lines, creating a calm, focused environment for learning and management.

## Colors
This design system utilizes a high-contrast palette to establish clear information hierarchy. 

- **Primary Blue (#3B82F6):** Used exclusively for call-to-actions, progress indicators, and active states to guide user focus.
- **Deep Blue (#1E293B):** Serves as the foundation for the "Dark Theme" sidebar and primary headers, grounding the interface with a sense of stability.
- **Light Gray (#F8FAFC):** Applied as the default canvas background to differentiate the main content area from elevated white cards.
- **White (#FFFFFF):** Reserved for interactive surfaces like cards, modals, and input fields to make them "pop" against the light gray background.

## Typography
The system uses **Inter** for all applications. It is a utilitarian typeface that excels in legibility, especially when dealing with the dense data common in SaaS dashboards. 

Headlines utilize tighter letter-spacing and heavier weights to provide a structured "anchor" for page sections. Body text is optimized for long-form reading with a generous 1.5–1.6 line-height. Small labels use a medium weight and slight tracking (letter-spacing) to ensure clarity in metadata and navigation items.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for dashboard content to maintain a manageable line length for reading, while the navigation remains docked. 

- **Grid:** A 12-column grid system with 24px gutters.
- **Sidebar:** Fixed at 280px. In "Dark Mode," it uses the Deep Blue (#1E293B) palette with a 1px border on the right (opacity 10%).
- **Rhythm:** An 8px linear scale is used for all spatial relationships. Elements within a card use `sm` or `md` spacing, while gaps between structural cards use `lg` or `xl` spacing to create clear groupings.

## Elevation & Depth
This design system avoids heavy gradients in favor of **Ambient Shadows** and **Tonal Layers**.

Depth is communicated through three levels:
1.  **Level 0 (Flat):** The background canvas (#F8FAFC).
2.  **Level 1 (Card):** White surfaces with a soft, diffused shadow (`0px 4px 12px rgba(30, 41, 59, 0.05)`). These cards contain the primary content.
3.  **Level 2 (Interaction):** Popovers, dropdowns, and modals. These use a more pronounced shadow (`0px 12px 24px rgba(30, 41, 59, 0.1)`) to indicate they are floating above the workspace.

Navigation sidebars, when white, use a subtle `1px` border (#E2E8F0) instead of a shadow to maintain a clean, architectural look.

## Shapes
The shape language is defined by **Rounded** geometry. This softens the "industrial" feel of a SaaS platform and makes the educational environment feel more welcoming.

- **Standard Elements:** Buttons, inputs, and small widgets use a **8px** radius.
- **Structural Elements:** Main content cards and containers use a **12px** radius.
- **Selection States:** Indicators and active menu items use a **6px** radius to sit comfortably within their parent containers.

## Components
- **Buttons:** Primary buttons are Solid Bright Blue (#3B82F6) with white text. Hover states shift the background to a slightly darker shade (#2563EB). Secondary buttons use a white fill with a subtle gray border.
- **Elegant Cards:** Cards are the primary container. They must have a white background, 12px border radius, and the Level 1 Ambient Shadow. Headers within cards should have a subtle bottom border (#F1F5F9).
- **Sidebar:** The "Deep Blue" sidebar uses a semi-transparent white (opacity 10%) for hover states on nav items. Icons should be simplified line-art style.
- **Input Fields:** Fields use a 1px border (#E2E8F0) and an 8px radius. On focus, the border changes to Bright Blue with a soft 2px outer glow.
- **Chips/Badges:** Used for course categories or status tags. They use a "soft-tint" approach (e.g., a light blue background with dark blue text) and a pill-shaped radius.
- **Course Progress Bars:** Uses a height of 8px, a light gray track, and a Bright Blue fill.