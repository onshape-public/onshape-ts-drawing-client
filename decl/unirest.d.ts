declare module 'unirest' {
  export interface IUniResponse {
    statusCode?: number;
    statusMessage?: string;
    error: Error;
    body: string;
    raw_body?: any;
  }
  export interface IUniRest {
    get(...args: any[]): IUniRest;
    post(...args: any[]): IUniRest;
    patch(...args: any[]): IUniRest;
    head(...args: any[]): IUniRest;
    put(...args: any[]): IUniRest;
    delete(...args: any[]): IUniRest;
    header(...args: any[]): IUniRest;
    type(...args: any[]): IUniRest;
    timeout(...args: any[]): IUniRest;
    send(...args: any[]): IUniRest;
    end(...args: any[]): IUniRest;
    encoding(...args: any[]): IUniRest;
  }
}
