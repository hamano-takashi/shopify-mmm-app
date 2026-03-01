export default function PrivacyPolicy() {
  return (
    <s-page title="Privacy Policy" backAction={{ url: "/app/settings" }}>
      <s-layout>
        <s-layout-section>
          <s-card>
            <s-box padding="600">
              <s-text variant="headingLg">Privacy Policy</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  Last updated: March 1, 2026
                </s-text>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">1. Introduction</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    MMM Analytics ("we", "our", or "the App") is committed to protecting your privacy.
                    This Privacy Policy explains how we collect, use, and safeguard your data when you
                    use our Shopify application.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">2. Data We Collect</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    We collect and process the following data from your Shopify store:
                  </s-text>
                  <ul style={{ marginTop: "8px", paddingLeft: "24px", lineHeight: "1.8" }}>
                    <li><strong>Aggregated order data:</strong> Daily net sales, order counts, and average order values. We do NOT store individual order details or customer information.</li>
                    <li><strong>Session and traffic data:</strong> Daily session counts, page views, and conversion rates from Shopify Analytics.</li>
                    <li><strong>Advertising cost data:</strong> Channel-level daily spend data that you upload via Excel files.</li>
                    <li><strong>Shop metadata:</strong> Your shop domain name and subscription plan status.</li>
                  </ul>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">3. Data We Do NOT Collect</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    We explicitly do NOT collect or store:
                  </s-text>
                  <ul style={{ marginTop: "8px", paddingLeft: "24px", lineHeight: "1.8" }}>
                    <li>Customer names, email addresses, or contact information</li>
                    <li>Payment or credit card information</li>
                    <li>Individual order line items or product details</li>
                    <li>Customer browsing behavior or tracking data</li>
                    <li>Any personally identifiable information (PII) of your customers</li>
                  </ul>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">4. How We Use Your Data</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    Your data is used exclusively for:
                  </s-text>
                  <ul style={{ marginTop: "8px", paddingLeft: "24px", lineHeight: "1.8" }}>
                    <li>Running Marketing Mix Modeling (MMM) analysis to measure channel contribution</li>
                    <li>Generating budget optimization recommendations</li>
                    <li>Displaying analytics dashboards within the app</li>
                    <li>Producing downloadable Excel reports for your use</li>
                  </ul>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">5. Data Storage & Security</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    All data is stored securely and encrypted in transit (TLS/SSL). We do not share,
                    sell, or transfer your data to any third parties. Your data is isolated per store
                    and is not accessible by other users.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">6. Data Retention & Deletion</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    You can delete all your data at any time from the Settings page. When you uninstall
                    the app, all associated data is automatically deleted within 48 hours in compliance
                    with Shopify's data protection requirements.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">7. GDPR Compliance</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    We comply with GDPR and handle all mandatory Shopify webhooks including customer
                    data requests, customer data erasure, and shop data erasure. Since we do not store
                    customer PII, data subject requests are fulfilled by confirming no personal data
                    is held.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">8. Shopify API Permissions</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    This app requests the following Shopify API scopes:
                  </s-text>
                  <ul style={{ marginTop: "8px", paddingLeft: "24px", lineHeight: "1.8" }}>
                    <li><strong>read_orders:</strong> To retrieve aggregated daily sales metrics for MMM analysis.</li>
                  </ul>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">9. Contact</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    If you have questions about this Privacy Policy, please contact us at:{" "}
                    <strong>support@entech0410.com</strong>
                  </s-text>
                </s-box>
              </s-box>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}
