---
name: AI Systems Laboratory
colors:
  surface: '#faf9f7'
  surface-dim: '#dadad8'
  surface-bright: '#faf9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f1'
  surface-container: '#efeeec'
  surface-container-high: '#e9e8e6'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1b'
  on-surface-variant: '#454652'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#757684'
  outline-variant: '#c5c5d4'
  surface-tint: '#4355b9'
  primary: '#24389c'
  on-primary: '#ffffff'
  primary-container: '#3f51b5'
  on-primary-container: '#cacfff'
  inverse-primary: '#bac3ff'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#424343'
  on-tertiary: '#ffffff'
  tertiary-container: '#5a5a5a'
  on-tertiary-container: '#d2d2d1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee0ff'
  primary-fixed-dim: '#bac3ff'
  on-primary-fixed: '#00105c'
  on-primary-fixed-variant: '#293ca0'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#faf9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e3e2e0'
  surface-border: '#E5E5E5'
  metadata-text: '#737373'
  code-bg: '#F1F0EE'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  metadata:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: 0.05em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  sidebar-width: 280px
  container-max: 1100px
  gutter: 32px
  margin-mobile: 20px
  unit: 8px
---

## Brand & Style
The design system is built for the "AI Systems Laboratory," embodying the precision and structured clarity of a senior engineer's documentation. The personality is defined by technical maturity, systems thinking, and professional execution.

The aesthetic follows a **Minimalist Editorial** approach with a "Technical Documentation" influence. It rejects flashy trends like neon gradients or glassmorphism in favor of high-quality typography, intentional whitespace, and fine structural elements. The interface should feel like a high-end operating system or a premium research paper: authoritative, calm, and meticulously organized. Key visual motifs include grid dots, hairline borders (0.5px), and numbered procedural headers.

## Colors
The palette is rooted in a warm, archival base to prevent the coldness often found in technical sites. 

- **Primary (#3F51B5):** A deep Indigo used sparingly for technical accents, active states, and system indicators. It represents the "intelligence" layer.
- **Neutral (#F9F8F6):** A warm white background that provides an editorial, paper-like quality.
- **Secondary (#1A1A1A):** A near-black for high-contrast typography, ensuring maximum legibility.
- **Tertiary (#888888):** A muted grey for secondary information, borders, and grid-dot patterns.

Contrast is used to define hierarchy rather than color intensity. Surfaces are generally flat, using value shifts rather than shadows to define depth.

## Typography
The typographic system relies on the interplay between a clean, modern sans-serif and a precise monospaced font. 

**Geist** serves as the primary typeface for headers and body copy, providing an efficient, engineered feel. **JetBrains Mono** is utilized for all metadata, labels, and technical specifications, reinforcing the "Systems Laboratory" narrative. 

Hierarchical numbering (e.g., 01, 02) should always be rendered in the label font. Large headlines should use tight letter-spacing to create a distinctive editorial "lockup" appearance.

## Layout & Spacing
The layout uses a **Fixed Sidebar Grid** model. 

- **Sidebar:** A permanent 280px left-aligned navigation area with a 0.5px vertical border. It contains the site identity, navigation, and system status indicators.
- **Main Canvas:** Content is centered within the remaining viewport with a maximum width of 1100px to maintain comfortable line lengths for technical reading.
- **Rhythm:** Spacing follows a strict 8px base unit. Section margins are generous to allow the "minimal editorial" feel to breathe.
- **Responsive:** On tablet and mobile, the sidebar transitions to a top-anchored drawer or a simplified header. The grid collapses to a single column with reduced margins (20px).

## Elevation & Depth
This design system avoids traditional box shadows to maintain its "flat-technical" aesthetic. 

- **Tonal Layers:** Depth is communicated through subtle background shifts. The primary canvas is `#F9F8F6`, while code blocks or secondary modules use a slightly cooler or darker neutral like `#F1F0EE`.
- **Fine Lines:** Hairline borders (0.5px) in `#E5E5E5` are the primary tool for separation. They should be used to frame sections and define the sidebar.
- **Grid Dots:** A subtle 8px or 16px repeating dot pattern in `#E5E5E5` can be used on the background of the main canvas to provide a sense of "engineering paper" without adding visual weight.

## Shapes
The shape language is **Sharp (0px)**. 

All buttons, input fields, cards, and image containers must have 90-degree corners. This reinforces the "System/OS" feel and aligns with the structural grid lines. In rare cases where a distinction is needed (such as a status dot), a 100% pill shape is permitted, but all structural UI elements remain strictly rectangular.

## Components

- **Buttons:** Sharp corners, 1px solid border of `#1A1A1A`. Primary buttons use a solid `#1A1A1A` background with `#F9F8F6` text. Ghost buttons use `#3F51B5` text with no background.
- **Metadata Tags:** Small, monospace labels in JetBrains Mono. They often include a prefix like `[TYPE]` or `ID: 082`.
- **System Indicators:** Small circles used for "Live" status or "System Ready" states, colored in the primary Deep Indigo.
- **Numbered Headers:** Every major section header is preceded by a monospace index (e.g., `01 / EXPERIENCE`).
- **Input Fields:** Minimalist. Only a bottom border (1px) that transitions to the primary Indigo on focus.
- **Cards:** Defined by 0.5px borders rather than shadows. Cards should feel like "modules" within a larger technical sheet.
- **Left Sidebar:** Contains the "System Log" or navigation, utilizing small typography and high vertical density compared to the main content canvas.