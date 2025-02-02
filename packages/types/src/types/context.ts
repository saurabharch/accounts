import { ConnectionInformations } from './connection-informations';
import { User } from './user';

export interface IContext<IUser extends User = User> {
  authToken?: string;
  user?: IUser;
  userId?: string;
  userAgent: string | null;
  ip: string | null;
  infos: ConnectionInformations;
}
