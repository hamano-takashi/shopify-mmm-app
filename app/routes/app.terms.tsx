export default function TermsOfService() {
  return (
    <s-page title="Terms of Service" backAction={{ url: "/app/settings" }}>
      <s-layout>
        <s-layout-section>
          <s-card>
            <s-box padding="600">
              <s-text variant="headingLg">Terms of Service</s-text>
              <s-box padding-block-start="200">
                <s-text variant="bodySm" tone="subdued">
                  Last updated: March 1, 2026
                </s-text>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">1. Acceptance of Terms</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    By installing and using MMM Analytics ("the App"), you agree to these Terms of
                    Service. If you do not agree to these terms, please uninstall the App.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">2. Service Description</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    MMM Analytics provides Marketing Mix Modeling analysis for Shopify stores.
                    The App analyzes your sales data and advertising spend to measure each marketing
                    channel's contribution to revenue, and provides budget optimization recommendations.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">3. Plans & Billing</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    The App offers three plans:
                  </s-text>
                  <ul style={{ marginTop: "8px", paddingLeft: "24px", lineHeight: "1.8" }}>
                    <li><strong>Free:</strong> Limited to 1 analysis per month with basic results view.</li>
                    <li><strong>Starter ($19/month):</strong> Unlimited analyses, Excel report export, and all channel details.</li>
                    <li><strong>Pro ($49/month):</strong> All Starter features plus saturation analysis and AI budget optimization.</li>
                  </ul>
                  <s-box padding-block-start="200">
                    <s-text variant="bodyMd">
                      Paid plans include a 7-day free trial. Billing is managed through Shopify's
                      billing system. You can cancel your subscription at any time through the Plans
                      page or Shopify admin.
                    </s-text>
                  </s-box>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">4. Analysis Accuracy</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    MMM analysis results are statistical estimates based on correlation patterns in
                    your data. While we strive for accuracy, results should be used as one input to
                    your marketing decisions, not as the sole basis. The App provides model accuracy
                    metrics (R² and MAPE) to help you evaluate result reliability. We do not guarantee
                    specific business outcomes from following the App's recommendations.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">5. Data Ownership</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    You retain full ownership of all data you provide to the App. We do not claim
                    any intellectual property rights over your data or analysis results. You may
                    export and delete your data at any time.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">6. Acceptable Use</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    You agree not to:
                  </s-text>
                  <ul style={{ marginTop: "8px", paddingLeft: "24px", lineHeight: "1.8" }}>
                    <li>Attempt to reverse engineer or exploit the App's analysis algorithms</li>
                    <li>Use automated tools to interact with the App outside of normal usage</li>
                    <li>Upload intentionally misleading or malicious data files</li>
                    <li>Resell or redistribute the App's analysis outputs as a service</li>
                  </ul>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">7. Limitation of Liability</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    The App is provided "as is" without warranties of any kind. To the maximum extent
                    permitted by law, we shall not be liable for any indirect, incidental, special,
                    or consequential damages arising from your use of the App, including lost profits
                    or business decisions made based on analysis results.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">8. Service Availability</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    We aim to maintain high availability but do not guarantee uninterrupted service.
                    We may perform maintenance or updates that temporarily affect availability. We
                    reserve the right to modify or discontinue features with reasonable notice.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">9. Changes to Terms</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    We may update these Terms from time to time. Continued use of the App after
                    changes constitutes acceptance of the revised terms.
                  </s-text>
                </s-box>
              </s-box>

              <s-box padding-block-start="600">
                <s-text variant="headingMd">10. Contact</s-text>
                <s-box padding-block-start="200">
                  <s-text variant="bodyMd">
                    For questions about these Terms, please contact us at:{" "}
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
