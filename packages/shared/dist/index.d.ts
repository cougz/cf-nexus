import { z } from "zod";
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    username: string;
    createdAt: string;
}, {
    id: string;
    username: string;
    createdAt: string;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const OIDCClientSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    redirectUris: z.ZodArray<z.ZodString, "many">;
    secret: z.ZodString;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    redirectUris: string[];
    secret: string;
    scopes: string[];
}, {
    id: string;
    name: string;
    redirectUris: string[];
    secret: string;
    scopes?: string[] | undefined;
}>;
export type OIDCClient = z.infer<typeof OIDCClientSchema>;
export declare const AuthCodeSchema: z.ZodObject<{
    code: z.ZodString;
    userId: z.ZodString;
    clientId: z.ZodString;
    redirectUri: z.ZodString;
    scopes: z.ZodArray<z.ZodString, "many">;
    codeChallenge: z.ZodOptional<z.ZodString>;
    codeChallengeMethod: z.ZodOptional<z.ZodEnum<["plain", "S256"]>>;
    expiresAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    scopes: string[];
    userId: string;
    clientId: string;
    redirectUri: string;
    expiresAt: number;
    codeChallenge?: string | undefined;
    codeChallengeMethod?: "plain" | "S256" | undefined;
}, {
    code: string;
    scopes: string[];
    userId: string;
    clientId: string;
    redirectUri: string;
    expiresAt: number;
    codeChallenge?: string | undefined;
    codeChallengeMethod?: "plain" | "S256" | undefined;
}>;
export type AuthCode = z.infer<typeof AuthCodeSchema>;
export declare const SessionSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    createdAt: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    userId: string;
    expiresAt: string;
}, {
    id: string;
    createdAt: string;
    userId: string;
    expiresAt: string;
}>;
export type Session = z.infer<typeof SessionSchema>;
export declare const TokenResponseSchema: z.ZodObject<{
    access_token: z.ZodString;
    id_token: z.ZodString;
    token_type: z.ZodLiteral<"Bearer">;
    expires_in: z.ZodNumber;
    refresh_token: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    access_token: string;
    id_token: string;
    token_type: "Bearer";
    expires_in: number;
    refresh_token?: string | undefined;
}, {
    access_token: string;
    id_token: string;
    token_type: "Bearer";
    expires_in: number;
    refresh_token?: string | undefined;
}>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
//# sourceMappingURL=index.d.ts.map