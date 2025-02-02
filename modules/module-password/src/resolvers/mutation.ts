import { CreateUserServicePassword } from '@accounts/types';
import {
  AccountsPassword,
  CreateUserErrors,
  SendResetPasswordEmailErrors,
  SendVerificationEmailErrors,
} from '@accounts/password';
import { AccountsServer, AccountsJsError } from '@accounts/server';
import { MutationResolvers } from '../models';

export const Mutation: MutationResolvers = {
  addEmail: async (_, { newEmail }, ctx) => {
    const { user, injector } = ctx;

    if (!(user && user.id)) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    await injector.get(AccountsPassword).addEmail(userId, newEmail);
    return null;
  },
  changePassword: async (_, { oldPassword, newPassword }, ctx) => {
    const { user, injector } = ctx;

    if (!(user && user.id)) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    await injector.get(AccountsPassword).changePassword(userId, oldPassword, newPassword);
    return null;
  },
  createUser: async (_, { user }, ctx) => {
    const { injector, infos } = ctx;
    const accountsServer = injector.get(AccountsServer);
    const accountsPassword = injector.get(AccountsPassword);

    let userId: string;

    try {
      userId = await accountsPassword.createUser(user as CreateUserServicePassword);
    } catch (error) {
      // If ambiguousErrorMessages is true we obfuscate the email or username already exist error
      // to prevent user enumeration during user creation
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof AccountsJsError &&
        (error.code === CreateUserErrors.EmailAlreadyExists ||
          error.code === CreateUserErrors.UsernameAlreadyExists)
      ) {
        return {};
      }
      throw error;
    }

    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages ? null : userId,
      };
    }

    // When initializing AccountsServer we check that enableAutologin and ambiguousErrorMessages options
    // are not enabled at the same time

    const createdUser = await accountsServer.findUserById(userId);

    // If we are here - user must be created successfully
    // Explicitly saying this to Typescript compiler
    const loginResult = await accountsServer.loginWithUser(createdUser!, infos);

    return {
      userId,
      loginResult,
    };
  },
  twoFactorSet: async (_, { code, secret }, ctx) => {
    const { user, injector } = ctx;

    // Make sure user is logged in
    if (!(user && user.id)) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    await injector.get(AccountsPassword).twoFactor.set(userId, secret as any, code);
    return null;
  },
  twoFactorUnset: async (_, { code }, ctx) => {
    const { user, injector } = ctx;

    // Make sure user is logged in
    if (!(user && user.id)) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    await injector.get(AccountsPassword).twoFactor.unset(userId, code);
    return null;
  },
  resetPassword: async (_, { token, newPassword }, ctx) => {
    const { injector, infos } = ctx;

    return injector.get(AccountsPassword).resetPassword(token, newPassword, infos);
  },
  sendResetPasswordEmail: async (_, { email }, ctx) => {
    const { injector } = ctx;
    const accountsServer = injector.get(AccountsServer);
    const accountsPassword = injector.get(AccountsPassword);

    try {
      await accountsPassword.sendResetPasswordEmail(email);
    } catch (error) {
      // If ambiguousErrorMessages is true,
      // to prevent user enumeration we fail silently in case there is no user attached to this email
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof AccountsJsError &&
        error.code === SendResetPasswordEmailErrors.UserNotFound
      ) {
        return null;
      }
      throw error;
    }

    return null;
  },
  verifyEmail: async (_, { token }, ctx) => {
    const { injector } = ctx;

    await injector.get(AccountsPassword).verifyEmail(token);
    return null;
  },
  sendVerificationEmail: async (_, { email }, ctx) => {
    const { injector } = ctx;
    const accountsServer = injector.get(AccountsServer);
    const accountsPassword = injector.get(AccountsPassword);

    try {
      await accountsPassword.sendVerificationEmail(email);
    } catch (error) {
      // If ambiguousErrorMessages is true,
      // to prevent user enumeration we fail silently in case there is no user attached to this email
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof AccountsJsError &&
        error.code === SendVerificationEmailErrors.UserNotFound
      ) {
        return null;
      }
      throw error;
    }
    return null;
  },
};
