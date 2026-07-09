export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
}

export interface IPageInspector {
  url(): Promise<string>;
  cookies(): Promise<Cookie[]>;
  text(selector: string): Promise<string | null>;
  exists(selector: string): Promise<boolean>;
}
