import { auth } from "@/auth";
import { Player } from "@/features/listener/components/player";
import { getListenerState } from "@/features/listener/server/get-listener-state";

export default async function PlayerPage() {
  const session = await auth();
  const listenerState = await getListenerState(session?.user?.id);

  return <Player state={listenerState} />;
}
