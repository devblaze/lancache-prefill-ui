/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "steam-user" {
  import { EventEmitter } from "events";

  interface SteamUserOptions {
    enablePicsCache?: boolean;
    autoRelogin?: boolean;
    dataDirectory?: string | null;
    language?: string;
    picsCacheAll?: boolean;
    changelistUpdateInterval?: number;
    protocol?: number;
    httpProxy?: string | null;
    socksProxy?: string | null;
  }

  interface LogOnDetails {
    accountName?: string;
    password?: string;
    refreshToken?: string;
  }

  interface ContentServer {
    type: string;
    sourceid: number;
    cell: number;
    load: number;
    preferred_server: boolean;
    weightedload: number;
    Host: string;
    vhost: string;
    https_support: string;
  }

  interface ManifestFile {
    filename: string;
    size: string;
    flags: number;
    sha_content: string;
    chunks: ManifestChunk[];
  }

  interface ManifestChunk {
    sha: string;
    crc: number;
    offset: string;
    cb_original: number;
    cb_compressed: number;
  }

  interface Manifest {
    files: ManifestFile[];
    filenames_encrypted: boolean;
  }

  interface AppInfo {
    appinfo: {
      common?: {
        name?: string;
        type?: string;
      };
      depots?: Record<
        string,
        {
          manifests?: {
            public?: { gid: string } | string;
          };
          maxsize?: string;
          depotfromapp?: string;
          config?: Record<string, unknown>;
        }
      >;
    };
    changenumber: number;
    missingToken: boolean;
  }

  class SteamUser extends EventEmitter {
    steamID: { getSteamID64(): string } | null;
    options: SteamUserOptions;
    picsCache: {
      changenumber: number;
      apps: Record<string, any>;
      packages: Record<string, any>;
      ownershipModified?: number;
    };

    constructor(options?: SteamUserOptions);

    logOn(details: LogOnDetails): void;
    logOff(): void;

    setOption(option: string, value: any): void;

    getOwnedApps(filter?: any): number[];

    getProductInfo(
      apps: number[],
      packages: number[],
      inclTokens?: boolean
    ): Promise<{
      apps: Record<string, AppInfo>;
      packages: Record<string, any>;
      unknownApps: number[];
      unknownPackages: number[];
    }>;

    getManifest(
      appID: number,
      depotID: number,
      manifestID: string,
      branchName: string
    ): Promise<{ manifest: Manifest }>;

    getRawManifest(
      appID: number,
      depotID: number,
      manifestID: string,
      branchName: string
    ): Promise<{ manifest: Buffer }>;

    downloadChunk(
      appID: number,
      depotID: number,
      chunkSha1: string,
      contentServer?: ContentServer
    ): Promise<{ chunk: Buffer }>;

    downloadFile(
      appID: number,
      depotID: number,
      fileManifest: ManifestFile,
      outputFilePath?: string
    ): Promise<{ type: string; file?: Buffer }>;

    getContentServers(
      appID?: number
    ): Promise<{ servers: ContentServer[] }>;

    getDepotDecryptionKey(
      appID: number,
      depotID: number
    ): Promise<{ key: Buffer }>;

    static EResult: Record<string, number>;
    static EPersonaState: Record<string, number>;
  }

  export = SteamUser;
}
