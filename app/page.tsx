import { redirect } from "next/navigation";

/**
 * The hub has one feature for now, so `/` is `/subscription`. Part 3 puts the dashboard here;
 * this file is the only place that knows the feature is the home page.
 */
export default function Home() {
  redirect("/subscription");
}
