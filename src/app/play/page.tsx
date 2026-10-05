import { redirect } from "next/navigation";

/** An address a visitor might guess for the game. The game starts on the start page. */
export default function PlayPage() {
  redirect("/");
}
