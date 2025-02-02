import { AccountsClientPassword } from '../src/client-password';
import { LoginResult, CreateUserResult } from '@accounts/types';

const mockCreateUserResult: CreateUserResult = {
  userId: '123',
};

const mockedClient = {
  transport: {
    createUser: jest.fn(() => Promise.resolve(mockCreateUserResult)),
    sendResetPasswordEmail: jest.fn(),
    resetPassword: jest.fn(),
    sendVerificationEmail: jest.fn(),
    verifyEmail: jest.fn(),
    addEmail: jest.fn(),
    changePassword: jest.fn(),
  },
  loginWithService: jest.fn(),
};
const accountsPassword = new AccountsClientPassword(mockedClient as any);

const user = {
  email: 'john@doe.com',
  password: 'john',
};

describe('AccountsClientPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(accountsPassword, 'hashPassword');
  });

  it('requires the client', async () => {
    expect(() => new AccountsClientPassword(null as any)).toThrow(
      'A valid client instance is required'
    );
  });

  describe('#options', () => {
    describe('hashPassword', () => {
      it('should use hashPassword option', () => {
        const hashPassword = jest.fn((pass) => pass);
        const accountsPasswordTest = new AccountsClientPassword(mockedClient as any, {
          hashPassword,
        });
        const res = accountsPasswordTest.hashPassword('pass');
        expect(hashPassword).toHaveBeenCalledWith('pass');
        expect(res).toBe('pass');
      });
    });
  });

  describe('createUser', () => {
    it('should hash password and call transport', async () => {
      await accountsPassword.createUser(user);
      expect(accountsPassword.hashPassword).toHaveBeenCalledTimes(1);
      expect(accountsPassword.hashPassword).toHaveBeenCalledWith(user.password);
      expect(mockedClient.transport.createUser).toHaveBeenCalledTimes(1);
      expect(mockedClient.transport.createUser).toHaveBeenCalledWith({
        email: user.email,
        password: user.password,
      });
    });

    it('should autologin user in case tokens are returned from transport', async () => {
      const mockLoginResult: LoginResult = {
        sessionId: 'session123',
        tokens: {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
        },
        user: {
          id: '123',
          deactivated: false,
        },
      };

      const mockedClientWithAutologin = {
        ...mockedClient,
        transport: {
          ...mockedClient.transport,
          createUser: jest.fn(() =>
            Promise.resolve({
              ...mockCreateUserResult,
              loginResult: mockLoginResult,
            })
          ),
        },
        setTokens: jest.fn(),
      };
      const accountsPassword = new AccountsClientPassword(mockedClientWithAutologin as any);

      await accountsPassword.createUser(user);

      expect(mockedClientWithAutologin.transport.createUser).toHaveBeenCalledTimes(1);
      expect(mockedClientWithAutologin.transport.createUser).toHaveBeenCalledWith({
        email: user.email,
        password: user.password,
      });

      expect(mockedClientWithAutologin.setTokens).toHaveBeenCalledTimes(1);
      expect(mockedClientWithAutologin.setTokens).toHaveBeenCalledWith(mockLoginResult.tokens);
    });
  });

  describe('login', () => {
    it('should hash password and call client', async () => {
      await accountsPassword.login(user as any);
      expect(accountsPassword.hashPassword).toHaveBeenCalledTimes(1);
      expect(accountsPassword.hashPassword).toHaveBeenCalledWith(user.password);
      expect(mockedClient.loginWithService).toHaveBeenCalledTimes(1);
      expect(mockedClient.loginWithService).toHaveBeenCalledWith('password', {
        email: user.email,
        password: user.password,
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should call transport', async () => {
      await accountsPassword.requestPasswordReset(user.email);
      expect(mockedClient.transport.sendResetPasswordEmail).toHaveBeenCalledWith(user.email);
    });
  });

  describe('resetPassword', () => {
    it('should hash password and call transport', async () => {
      const token = 'tokenTest';
      const newPassword = 'newPasswordTest';
      await accountsPassword.resetPassword(token, newPassword);
      expect(accountsPassword.hashPassword).toHaveBeenCalledTimes(1);
      expect(accountsPassword.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(mockedClient.transport.resetPassword).toHaveBeenCalledTimes(1);
      expect(mockedClient.transport.resetPassword).toHaveBeenCalledWith(token, newPassword);
    });
  });

  describe('requestVerificationEmail', () => {
    it('should call transport', async () => {
      await accountsPassword.requestVerificationEmail(user.email);
      expect(mockedClient.transport.sendVerificationEmail).toHaveBeenCalledWith(user.email);
    });
  });

  describe('verifyEmail', () => {
    it('should call transport', async () => {
      await accountsPassword.verifyEmail(user.email);
      expect(mockedClient.transport.verifyEmail).toHaveBeenCalledWith(user.email);
    });
  });

  describe('addEmail', () => {
    it('should call transport', async () => {
      await accountsPassword.addEmail(user.email);
      expect(mockedClient.transport.addEmail).toHaveBeenCalledWith(user.email);
    });
  });

  describe('changePassword', () => {
    it('should hash password and call transport', async () => {
      const newPassword = 'newPasswordTest';
      await accountsPassword.changePassword(user.password, newPassword);
      expect(accountsPassword.hashPassword).toHaveBeenCalledTimes(2);
      expect(accountsPassword.hashPassword).toHaveBeenNthCalledWith(1, user.password);
      expect(accountsPassword.hashPassword).toHaveBeenNthCalledWith(2, newPassword);
      expect(mockedClient.transport.changePassword).toHaveBeenCalledTimes(1);
      expect(mockedClient.transport.changePassword).toHaveBeenCalledWith(
        user.password,
        newPassword
      );
    });
  });
});
