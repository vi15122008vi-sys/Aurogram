export interface CallRequest {
  room: string;
  title: string;
}

type Listener = (request: CallRequest) => void;

let listener: Listener | null = null;

/** Открывает оверлей звонка из любого места приложения (например, из ChatList). */
export function openCall(request: CallRequest): void {
  listener?.(request);
}

export function subscribeCallRequests(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
