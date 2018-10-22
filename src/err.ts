export class Err extends Error {
  innerError: Error | undefined;
  constructor(message: string, innerError?: Error) {
    super(message);
    if (innerError) {
      this.innerError = innerError; 
    }
    Object.setPrototypeOf(this, Err.prototype);
  }
}
