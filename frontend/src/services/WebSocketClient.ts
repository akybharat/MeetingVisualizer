export class WebSocketClient {
  private ws: WebSocket;
  private messageHandlers: ((data: any) => void)[] = [];
  private connectHandlers: (() => void)[] = [];
  private disconnectHandlers: (() => void)[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      this.connectHandlers.forEach(handler => handler());
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.disconnectHandlers.forEach(handler => handler());
    };
  }

  public sendAudio(audioData: Float32Array) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const buffer = audioData.buffer;
      this.ws.send(buffer);
    }
  }

  public onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }

  public onConnect(handler: () => void) {
    this.connectHandlers.push(handler);
  }

  public onDisconnect(handler: () => void) {
    this.disconnectHandlers.push(handler);
  }

  public disconnect() {
    this.ws.close();
  }
} 