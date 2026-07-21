declare module "aes-js" {
  type Bytes = Uint8Array | number[];
  class Counter {
    constructor(value?: number | Bytes);
  }
  class Ctr {
    constructor(key: Bytes, counter: Counter);
    encrypt(value: Bytes): Uint8Array;
    decrypt(value: Bytes): Uint8Array;
  }
  const aesjs: {
    Counter: typeof Counter;
    ModeOfOperation: { ctr: typeof Ctr };
    utils: {
      hex: { toBytes(value: string): Uint8Array; fromBytes(value: Bytes): string };
      utf8: { toBytes(value: string): Uint8Array; fromBytes(value: Bytes): string };
    };
  };
  export = aesjs;
}
