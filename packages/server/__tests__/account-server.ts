import 'reflect-metadata';
import jwtDecode from 'jwt-decode';
import { AccountsServer } from '../src/accounts-server';
import { JwtData } from '../src/types/jwt-data';
import { ServerHooks } from '../src/utils/server-hooks';

const delay = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));

describe('AccountsServer', () => {
  const db = {
    findUserByUsername: () => Promise.resolve(),
    findUserByEmail: () => Promise.resolve(),
    createUser: () => Promise.resolve(),
    createSession: () => Promise.resolve(),
  };

  describe('config', () => {
    it('should throw if ambiguousErrorMessages and enableAutologin flags enabled at the same time', async () => {
      expect(
        () =>
          new AccountsServer(
            {
              tokenSecret: 'secret1',
              enableAutologin: true,
              ambiguousErrorMessages: true,
            },
            {},
            {} as any
          )
      )
        .toThrow(`Can't enable autologin when ambiguous error messages are enabled (https://www.accountsjs.com/docs/api/server/globals#ambiguouserrormessages).
Please set ambiguousErrorMessages to false to be able to use autologin.`);
    });
  });

  describe('getServices', () => {
    it('should return instance services', async () => {
      const services: any = {
        password: {
          setUserStore: jest.fn(),
          setSessionsStore: jest.fn(),
        },
      };
      const account = new AccountsServer({ tokenSecret: 'secret1' }, services, {} as any);
      expect(account.getServices()).toEqual(services);
    });
  });

  describe('loginWithService', () => {
    it('throws on invalid service', async () => {
      const accountServer = new AccountsServer({ tokenSecret: 'secret1' }, {}, {} as any);
      await expect(accountServer.loginWithService('facebook', {}, {})).rejects.toThrow(
        'No service with the name facebook was registered.'
      );
    });

    it('throws when user not found', async () => {
      const authenticate = jest.fn(() => Promise.resolve());
      const service: any = { authenticate, setUserStore: jest.fn(), setSessionsStore: jest.fn() };
      const accountServer = new AccountsServer(
        { tokenSecret: 'secret1' },
        {
          facebook: service,
        },
        {} as any
      );
      await expect(accountServer.loginWithService('facebook', {}, {})).rejects.toThrow(
        'Service facebook was not able to authenticate user'
      );
    });

    it('throws when user is deactivated', async () => {
      const authenticate = jest.fn(() => Promise.resolve({ id: 'userId', deactivated: true }));
      const service: any = { authenticate, setUserStore: jest.fn(), setSessionsStore: jest.fn() };
      const accountServer = new AccountsServer(
        { tokenSecret: 'secret1' },
        {
          facebook: service,
        },
        {} as any
      );
      await expect(accountServer.loginWithService('facebook', {}, {})).rejects.toThrow(
        'Your account has been deactivated'
      );
    });

    it('should return tokens', async () => {
      const authenticate = jest.fn(() => Promise.resolve({ id: 'userId' }));
      const createSession = jest.fn(() => Promise.resolve('sessionId'));
      const service: any = { authenticate, setUserStore: jest.fn(), setSessionsStore: jest.fn() };
      const accountServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {
          facebook: service,
        },
        {
          createSession,
        } as any
      );
      const res = await accountServer.loginWithService('facebook', {}, {});
      expect(res.tokens).toBeTruthy();
    });
  });

  describe('authenticateWithService', () => {
    it('throws on invalid service', async () => {
      const accountServer = new AccountsServer({ tokenSecret: 'secret1' }, {}, {} as any);
      await expect(accountServer.authenticateWithService('facebook', {}, {})).rejects.toThrow(
        'No service with the name facebook was registered.'
      );
    });

    it('throws when user not found', async () => {
      const authenticate = jest.fn(() => Promise.resolve());
      const service: any = { authenticate, setUserStore: jest.fn(), setSessionsStore: jest.fn() };
      const accountServer = new AccountsServer(
        { tokenSecret: 'secret1' },
        {
          facebook: service,
        },
        {} as any
      );
      await expect(accountServer.authenticateWithService('facebook', {}, {})).rejects.toThrow(
        'Service facebook was not able to authenticate user'
      );
    });

    it('throws when user is deactivated', async () => {
      const authenticate = jest.fn(() => Promise.resolve({ id: 'userId', deactivated: true }));
      const service: any = { authenticate, setUserStore: jest.fn(), setSessionsStore: jest.fn() };
      const accountServer = new AccountsServer(
        { tokenSecret: 'secret1' },
        {
          facebook: service,
        },
        {} as any
      );
      await expect(accountServer.authenticateWithService('facebook', {}, {})).rejects.toThrow(
        'Your account has been deactivated'
      );
    });

    it('should return true upon success', async () => {
      const authenticate = jest.fn(() => Promise.resolve({ id: 'userId' }));
      const createSession = jest.fn(() => Promise.resolve('sessionId'));
      const service: any = { authenticate, setUserStore: jest.fn(), setSessionsStore: jest.fn() };
      const accountServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {
          facebook: service,
        },
        {
          createSession,
        } as any
      );
      const res = await accountServer.authenticateWithService('facebook', {}, {});
      expect(res).toBeTruthy();
    });
  });

  describe('loginWithUser', () => {
    it('creates a session when given a proper user object', async () => {
      const user = {
        id: '123',
        username: 'username',
        email: 'email@email.com',
        deactivated: false,
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          createJwtPayload: async (data, user) => {
            return { username: user.username };
          },
        },
        {},
        {
          createSession: () => Promise.resolve('sessionId'),
        } as any
      );

      const res = await accountsServer.loginWithUser(user, {});
      const {
        user: loggedInUser,
        tokens: { accessToken, refreshToken },
      } = res;
      const decodedAccessToken: { data: JwtData; username: string } = jwtDecode(accessToken);
      expect(decodedAccessToken.data.token).toBeTruthy();
      expect(decodedAccessToken.username).toEqual(user.username);
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      expect(loggedInUser.id).toBe(user.id);
    });
  });

  describe('logout', () => {
    it('invalidates session', async () => {
      const invalidateSession = jest.fn(() => Promise.resolve());
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };

      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          invalidateSession,
        } as any
      );

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      await accountsServer.logout(accessToken);
      expect(invalidateSession).toHaveBeenCalledWith('456');
    });
  });

  describe('hooks', () => {
    const connectionInfo = {
      userAgent: 'user-agent-test',
      ip: 'ip-test',
    };
    it('ServerHooks.LoginSuccess', async () => {
      const user = { id: 'id-test' };
      const hookSpy = jest.fn(() => null);
      const services: any = {
        password: {
          setUserStore: jest.fn(),
          setSessionsStore: jest.fn(),
          authenticate: jest.fn(() => Promise.resolve(user)),
        },
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        services,
        {
          createSession: () => '123',
        } as any
      );
      accountsServer.on(ServerHooks.LoginSuccess, hookSpy);
      await accountsServer.loginWithService('password', { key: 'value' }, connectionInfo);
      await delay(10);
      expect(hookSpy).toHaveBeenCalledWith({
        service: 'password',
        connection: connectionInfo,
        user,
        params: { key: 'value' },
      });
    });

    it('ServerHooks.LoginError', async () => {
      const user = { id: 'id-test' };
      const services: any = {
        password: {
          setUserStore: jest.fn(),
          setSessionsStore: jest.fn(),
          authenticate: jest.fn(() => Promise.resolve(user)),
        },
      };
      const hookSpy = jest.fn(() => null);
      const SessionError = new Error('Could not create session');
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        services,
        {
          createSession: () => {
            throw SessionError;
          },
        } as any
      );
      accountsServer.on(ServerHooks.LoginError, hookSpy);

      try {
        await accountsServer.loginWithService('password', { key: 'value' }, connectionInfo);
      } catch (e) {
        // nothing to do
      }
      await delay(10);
      expect(hookSpy).toHaveBeenCalledWith({
        service: 'password',
        connection: connectionInfo,
        user,
        params: { key: 'value' },
        error: SessionError,
      });
    });

    it('ServerHooks.LogoutSuccess', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };

      const hookSpy = jest.fn(() => null);
      const invalidateSession = jest.fn(() => Promise.resolve());
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
          invalidateSession,
        } as any
      );
      accountsServer.on(ServerHooks.LogoutSuccess, hookSpy);

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      await accountsServer.logout(accessToken);
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.LogoutError', async () => {
      const user = {
        id: '122',
        username: 'username',
        deactivated: false,
      };

      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(null),
        } as any
      );
      accountsServer.on(ServerHooks.LogoutError, hookSpy);

      try {
        const { accessToken } = await accountsServer.createTokens({ token: '456', user });
        await accountsServer.logout(accessToken);
      } catch (err) {
        // nothing to do
      }
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.ResumeSessionSuccess', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
          resumeSessionValidator: () => Promise.resolve(user),
        } as any
      );
      accountsServer.on(ServerHooks.ResumeSessionSuccess, hookSpy);

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      await accountsServer.resumeSession(accessToken);
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.ResumeSessionError with invalid session', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          resumeSessionValidator: () => Promise.resolve(),
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: false,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
        } as any
      );
      accountsServer.on(ServerHooks.ResumeSessionError, hookSpy);

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });

      try {
        await accountsServer.resumeSession(accessToken);
      } catch (e) {
        // nothing to do
      }
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.ResumeSessionError with invalid errored session', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          resumeSessionValidator: () => Promise.resolve(),
        },
        {},
        {
          findSessionByToken: () => Promise.reject(''),
          findUserById: () => Promise.resolve(user),
        } as any
      );
      accountsServer.on(ServerHooks.ResumeSessionError, hookSpy);

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });

      try {
        await accountsServer.resumeSession(accessToken);
      } catch (e) {
        // nothing to do
      }
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.RefreshTokensError', async () => {
      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              valid: false,
            }),
        } as any
      );
      accountsServer.on(ServerHooks.RefreshTokensError, hookSpy);

      try {
        const { accessToken, refreshToken } = await accountsServer.createTokens({
          token: '456',
          user: {
            id: 'userId',
            deactivated: false,
          },
        });
        await accountsServer.refreshTokens(accessToken, refreshToken, {
          ip: 'ip',
          userAgent: 'userAgent',
        });
      } catch (err) {
        // nothing to do
      }
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.RefreshTokensSuccess', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
          updateSession: () => Promise.resolve(),
        } as any
      );
      accountsServer.on(ServerHooks.RefreshTokensSuccess, hookSpy);

      const { accessToken, refreshToken } = await accountsServer.createTokens({
        token: '456',
        user,
      });
      accountsServer.createTokens = async () => ({
        accessToken: 'newAccessToken',
        refreshToken: 'newRefreshToken',
      });

      await accountsServer.refreshTokens(accessToken, refreshToken, {
        ip: 'ip',
        userAgent: 'userAgent',
      });
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.ImpersonationError', async () => {
      const hookSpy = jest.fn(() => null);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        db as any
      );
      accountsServer.on(ServerHooks.ImpersonationError, hookSpy);

      try {
        const accessToken = null as any;
        const impersonated = null as any;
        await accountsServer.impersonate(accessToken, impersonated, {
          ip: 'ip',
          userAgent: 'userAgent',
        });
      } catch (err) {
        // nothing to do
      }
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });

    it('ServerHooks.ImpersonationSuccess', async () => {
      const user = { username: 'myUser', id: '123', deactivated: false };
      const impersonatedUser = { username: 'impUser', id: '456' };
      const findUserById = jest.fn();
      findUserById.mockReturnValueOnce(user).mockReturnValueOnce(impersonatedUser);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          impersonationAuthorize: async (userObject, impersonateToUser) => {
            return userObject.id === user.id && impersonateToUser === impersonatedUser;
          },
        },
        {},
        {
          findUserById,
          createSession: () => Promise.resolve('001'),
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      const hookSpy = jest.fn(() => null);
      accountsServer.on(ServerHooks.ImpersonationSuccess, hookSpy);

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: true,
          userId: '123',
        } as any);
      accountsServer.createTokens = ({ token, isImpersonated = false, user }) =>
        ({
          isImpersonated,
          token,
          user,
        }) as any;

      await accountsServer.impersonate(
        accessToken,
        { userId: 'userId' },
        {
          ip: 'ip',
          userAgent: 'userAgent',
        }
      );
      await delay(10);
      expect(hookSpy).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('updates session and returns new tokens and user', async () => {
      const updateSession = jest.fn(() => Promise.resolve());
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
          updateSession,
        } as any
      );
      const { accessToken, refreshToken } = await accountsServer.createTokens({
        token: '456',
        user,
      });
      accountsServer.createTokens = async () => ({
        accessToken: 'newAccessToken',
        refreshToken: 'newRefreshToken',
      });
      const res = await accountsServer.refreshTokens(accessToken, refreshToken, {
        ip: 'ip',
        userAgent: 'userAgent',
      });
      expect(updateSession.mock.calls[0]).toEqual([
        '456',
        { ip: 'ip', userAgent: 'userAgent' },
        undefined,
      ]);
      expect(res).toEqual({
        infos: {
          ip: 'ip',
          userAgent: 'userAgent',
        },
        sessionId: '456',
        tokens: {
          accessToken: 'newAccessToken',
          refreshToken: 'newRefreshToken',
        },
        user,
      });
    });

    it('updates session and returns new tokens and user with new session token', async () => {
      const updateSession = jest.fn(() => Promise.resolve());
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          createNewSessionTokenOnRefresh: true,
          tokenCreator: {
            createToken: async () => {
              return '123';
            },
          },
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
          updateSession,
        } as any
      );
      const { accessToken, refreshToken } = await accountsServer.createTokens({
        token: '456',
        user,
      });
      accountsServer.createTokens = async () => ({
        accessToken: 'newAccessToken',
        refreshToken: 'newRefreshToken',
      });

      const res = await accountsServer.refreshTokens(accessToken, refreshToken, {
        ip: 'ip',
        userAgent: 'userAgent',
      });
      expect(updateSession.mock.calls[0]).toEqual([
        '456',
        { ip: 'ip', userAgent: 'userAgent' },
        '123',
      ]);
      expect(res).toEqual({
        infos: {
          ip: 'ip',
          userAgent: 'userAgent',
        },
        sessionId: '456',
        tokens: {
          accessToken: 'newAccessToken',
          refreshToken: 'newRefreshToken',
        },
        user,
      });
    });

    it('requires access and refresh tokens', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      await expect(
        accountsServer.refreshTokens(null as any, null as any, {
          ip: 'ip',
          userAgent: 'userAgent',
        })
      ).rejects.toThrow('An accessToken and refreshToken are required');
    });
    it('throws error if tokens are not valid', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      await expect(
        accountsServer.refreshTokens('bad access token', 'bad refresh token', {
          ip: 'ip',
          userAgent: 'userAgent',
        })
      ).rejects.toThrow('Tokens are not valid');
    });

    it('throws error if session not found', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () => Promise.resolve(null),
        } as any
      );
      const { accessToken, refreshToken } = await accountsServer.createTokens({
        token: '123',
        user: {
          id: '213',
          deactivated: false,
        },
      });
      await expect(
        accountsServer.refreshTokens(accessToken, refreshToken, {
          ip: 'ip',
          userAgent: 'userAgent',
        })
      ).rejects.toThrow('Session not found');
    });

    it('throws error if session not valid', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              valid: false,
            }),
        } as any
      );
      const { accessToken, refreshToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });
      await expect(
        accountsServer.refreshTokens(accessToken, refreshToken, {
          ip: 'ip',
          userAgent: 'userAgent',
        })
      ).rejects.toThrow('Session is no longer valid');
    });

    it('throws error if user not found', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(null),
        } as any
      );

      const { accessToken, refreshToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });
      await expect(
        accountsServer.refreshTokens(accessToken, refreshToken, {
          ip: 'ip',
          userAgent: 'userAgent',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('findSessionByAccessToken', () => {
    it('requires access token', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      await expect(accountsServer.logout(null as any)).rejects.toThrow(
        'An accessToken is required'
      );
    });

    it('throws error if tokens are not valid', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      await expect(accountsServer.logout('bad access token')).rejects.toThrow(
        'Tokens are not valid'
      );
    });

    it('throws error if session not found', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () => Promise.resolve(null),
        } as any
      );

      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });
      await expect(accountsServer.logout(accessToken)).rejects.toThrow('Session not found');
    });

    it('throws error if session not valid', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              valid: false,
            }),
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });
      await expect(accountsServer.logout(accessToken)).rejects.toThrow(
        'Session is no longer valid'
      );
    });
  });

  describe('findUserById', () => {
    it('call this.db.findUserById', async () => {
      const findUserById = jest.fn(() => Promise.resolve('user'));
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        { findUserById } as any
      );
      const user = await accountsServer.findUserById('id');
      expect(findUserById.mock.calls[0]).toEqual(['id']);
      expect(user).toEqual('user');
    });
  });

  describe('resumeSession', () => {
    it('throws error if access token is not provided', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );

      await expect(accountsServer.resumeSession(undefined as any)).rejects.toThrow(
        'An accessToken is required'
      );
    });

    it('throws error if user is not found', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(null),
        } as any
      );

      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });
      await expect(accountsServer.resumeSession(accessToken)).rejects.toThrow('User not found');
    });

    it('should throw if session is not found', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () => Promise.resolve(null),
        } as any
      );

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      await expect(accountsServer.resumeSession(accessToken)).rejects.toThrow('Session not found');
    });

    it('should throw if session is not valid', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: false,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
        } as any
      );

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      await expect(accountsServer.resumeSession(accessToken)).rejects.toThrow('Invalid Session');
    });

    it('return user', async () => {
      const user = {
        id: '123',
        username: 'username',
        deactivated: false,
      };
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findSessionByToken: () =>
            Promise.resolve({
              id: '456',
              valid: true,
              userId: '123',
            }),
          findUserById: () => Promise.resolve(user),
        } as any
      );

      const { accessToken } = await accountsServer.createTokens({ token: '456', user });
      const foundUser = await accountsServer.resumeSession(accessToken);
      expect(foundUser).toEqual(user);
    });
  });

  describe('deactivateUser', () => {
    it('call this.db.setUserDeactivated', async () => {
      const setUserDeactivated = jest.fn(() => Promise.resolve('user'));
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        { setUserDeactivated } as any
      );
      await accountsServer.deactivateUser('id');
      expect(setUserDeactivated.mock.calls[0]).toEqual(['id', true]);
    });
  });

  describe('activateUser', () => {
    it('call this.db.setUserDeactivated', async () => {
      const setUserDeactivated = jest.fn(() => Promise.resolve('user'));
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        { setUserDeactivated } as any
      );
      await accountsServer.activateUser('id');
      expect(setUserDeactivated.mock.calls[0]).toEqual(['id', false]);
    });
  });

  describe('impersonate', () => {
    const user = { username: 'myUser', id: '123', deactivated: false };
    const impersonatedUser = { username: 'impUser', id: '456' };
    const someUser = { username: 'someUser', id: '789' };

    it('throws error if no access token is provided', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        db as any
      );

      const accessToken = null as any;
      const impersonated = null as any;
      await expect(
        accountsServer.impersonate(accessToken, impersonated, {
          ip: 'ip',
          userAgent: 'userAgent',
        })
      ).rejects.toThrow('An accessToken is required');
    });

    it('throws error if access token is not valid', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );

      await expect(
        accountsServer.impersonate(
          'invalidToken',
          {},
          {
            ip: 'ip',
            userAgent: 'userAgent',
          }
        )
      ).rejects.toThrow('Tokens are not valid');
    });

    it('throws error if session is not valid', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: false,
          userId: '123',
        } as any);

      await expect(
        accountsServer.impersonate(
          accessToken,
          {},
          {
            ip: 'ip',
            userAgent: 'userAgent',
          }
        )
      ).rejects.toThrow('Session is not valid for user');
    });

    it('throws error if user is not found', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findUserById: () => Promise.resolve(null),
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: true,
          userId: '123',
        } as any);

      await expect(
        accountsServer.impersonate(
          accessToken,
          { userId: 'userId' },
          {
            ip: 'ip',
            userAgent: 'userAgent',
          }
        )
      ).rejects.toThrow('User not found');
    });

    it('throws error if impersonated user is not found', async () => {
      const findUserById = jest.fn();
      findUserById.mockReturnValueOnce(user);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          ambiguousErrorMessages: false,
        },
        {},
        {
          findUserById,
          findUserByUsername: () => Promise.resolve(null),
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: true,
          userId: '123',
        } as any);

      await expect(
        accountsServer.impersonate(
          accessToken,
          { userId: 'userId' },
          {
            ip: 'ip',
            userAgent: 'userAgent',
          }
        )
      ).rejects.toThrow('Impersonated user not found');
    });

    it('returns not authorized if impersonationAuthorize function is not passed in config', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {
          findUserById: () => Promise.resolve(user),
          findUserByUsername: () => Promise.resolve(someUser),
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: true,
          userId: '123',
        } as any);

      const res = await accountsServer.impersonate(
        accessToken,
        { userId: 'userId' },
        {
          ip: 'ip',
          userAgent: 'userAgent',
        }
      );
      expect(res.authorized).toEqual(false);
    });

    it('returns not authorized if impersonationAuthorize return false', async () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          impersonationAuthorize: async (userObject, impersonateToUser) => {
            return userObject.id === user.id && impersonateToUser === impersonatedUser;
          },
        },
        {},
        {
          findUserById: () => Promise.resolve(user),
          findUserByUsername: () => Promise.resolve(someUser),
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({
        token: '456',
        user: {
          id: 'userId',
          deactivated: false,
        },
      });

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: true,
          userId: '123',
        } as any);

      const impersonationAuthorize = accountsServer.getOptions().impersonationAuthorize;
      expect(impersonationAuthorize).toBeDefined();

      const res = await accountsServer.impersonate(
        accessToken,
        { userId: 'userId' },
        {
          ip: 'ip',
          userAgent: 'userAgent',
        }
      );
      expect(res.authorized).toEqual(false);
    });

    it('returns correct response if authorized', async () => {
      const createSession = jest.fn(() => Promise.resolve('001'));
      const findUserById = jest.fn();
      findUserById.mockReturnValueOnce(user).mockReturnValueOnce(impersonatedUser);
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          impersonationAuthorize: async (userObject, impersonateToUser) => {
            return userObject.id === user.id && impersonateToUser === impersonatedUser;
          },
          tokenCreator: {
            createToken: async () => {
              return '123';
            },
          },
        },
        {},
        {
          findUserById,
          createSession,
        } as any
      );
      const { accessToken } = await accountsServer.createTokens({ token: '456', user });

      accountsServer.findSessionByAccessToken = () =>
        Promise.resolve({
          valid: true,
          userId: '123',
        } as any);
      accountsServer.createTokens = ({ token, isImpersonated = false }) =>
        ({
          token,
          isImpersonated,
        }) as any;

      const res = await accountsServer.impersonate(
        accessToken,
        { userId: 'userId' },
        {
          ip: 'ip',
          userAgent: 'userAgent',
        }
      );
      expect(res).toEqual({
        authorized: true,
        tokens: { token: '123', isImpersonated: true },
        user: impersonatedUser,
      });
      expect(createSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { ip: 'ip', userAgent: 'userAgent' },
        {
          impersonatorUserId: user.id,
        }
      );
    });
  });

  describe('user sanitizer', () => {
    const userObject = { username: 'test', services: [], id: '123', deactivated: false };

    it('internal sanitizer should clean services field from the user object', () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        db as any
      );
      const modifiedUser = accountsServer.sanitizeUser(userObject);
      expect(modifiedUser.services).toBeUndefined();
    });

    it('should run external sanitizier when provided one', () => {
      const accountsServer = new AccountsServer(
        {
          tokenSecret: 'secret1',
          userObjectSanitizer: (user) => {
            const {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              username,
              ...sanitizedUser
            } = user;
            return sanitizedUser;
          },
        },
        {},
        db as any
      );
      const modifiedUser = accountsServer.sanitizeUser(userObject);
      expect(modifiedUser.username).toBeUndefined();
    });
  });

  describe('getSecretOrPublicKey', () => {
    it('return secert', async () => {
      const accountsServer: any = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      expect(accountsServer.getSecretOrPublicKey()).toEqual('secret1');
    });

    it('return public key', async () => {
      const accountsServer: any = new AccountsServer(
        {
          tokenSecret: {
            publicKey: 'publicKey1',
            privateKey: 'privateKey1',
          },
        },
        {},
        {} as any
      );
      expect(accountsServer.getSecretOrPublicKey()).toEqual('publicKey1');
    });
  });

  describe('getSecretOrPrivateKey', () => {
    it('return secert', async () => {
      const accountsServer: any = new AccountsServer(
        {
          tokenSecret: 'secret1',
        },
        {},
        {} as any
      );
      expect(accountsServer.getSecretOrPrivateKey()).toEqual('secret1');
    });

    it('return private key', async () => {
      const accountsServer: any = new AccountsServer(
        {
          tokenSecret: {
            publicKey: 'publicKey1',
            privateKey: 'privateKey1',
          },
        },
        {},
        {} as any
      );
      expect(accountsServer.getSecretOrPrivateKey()).toEqual('privateKey1');
    });
  });
});
