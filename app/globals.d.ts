declare module "*.css";

// Override Shopify Polaris Web Components types with permissive definitions.
// The @shopify/polaris-types package provides strict types that don't match
// all runtime-supported attributes. These overrides ensure TypeScript
// compatibility while the Web Components work correctly at runtime.
type PolarisWebComponentProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement> & Record<string, unknown>,
  HTMLElement
>;

declare namespace JSX {
  interface IntrinsicElements {
    // Core components (override strict types)
    "s-page": PolarisWebComponentProps;
    "s-text": PolarisWebComponentProps;
    "s-box": PolarisWebComponentProps;
    "s-banner": PolarisWebComponentProps;
    "s-badge": PolarisWebComponentProps;
    "s-button": PolarisWebComponentProps;
    "s-button-group": PolarisWebComponentProps;
    "s-section": PolarisWebComponentProps;
    "s-select": PolarisWebComponentProps;
    "s-spinner": PolarisWebComponentProps;
    "s-text-field": PolarisWebComponentProps;
    "s-link": PolarisWebComponentProps;
    "s-app-nav": PolarisWebComponentProps;
    // Layout components (not in @shopify/polaris-types)
    "s-layout": PolarisWebComponentProps;
    "s-layout-section": PolarisWebComponentProps;
    "s-card": PolarisWebComponentProps;
    "s-resource-list": PolarisWebComponentProps;
    "s-resource-item": PolarisWebComponentProps;
    "s-empty-state": PolarisWebComponentProps;
    "s-inline": PolarisWebComponentProps;
  }
}
