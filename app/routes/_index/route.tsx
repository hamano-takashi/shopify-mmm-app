import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>MMM Analytics for Shopify</h1>
        <p className={styles.text}>
          Marketing Mix Modeling powered by Bayesian statistics.
          Understand your true channel contribution and optimize budget allocation.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Channel Contribution</strong>. Discover how each marketing
            channel truly drives your sales with scientific modeling.
          </li>
          <li>
            <strong>Budget Optimization</strong>. Get data-driven recommendations
            for optimal budget allocation across channels.
          </li>
          <li>
            <strong>Saturation Analysis</strong>. Know when you're overspending
            on a channel with diminishing returns curves.
          </li>
        </ul>
      </div>
    </div>
  );
}
