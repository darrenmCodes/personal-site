import { redirect } from "next/navigation";

// Milestone 1 only has the test reel. The real opening replaces this in M2.
export default function Home() {
  redirect("/test-reel");
}
