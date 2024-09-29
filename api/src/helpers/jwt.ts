import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { jwtSecret, errorCodes } from '../etc/state';

export interface AuthenticatedRequest extends Request {
    user?: any;
}
  
export const authenticatedShi = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.body.jwt;
    if (token) {
      try {
        jwt.verify(token, jwtSecret, async (err: any, decoded:any) => {
            if (err) {
                return res.status(401).json(errorCodes.jwtDecodeFailed);
            } else {
                req.user = decoded;
                next();
            }
        });
      } catch (err) {
        return res.status(401).json(errorCodes.jwtDecodeFailed);
      }
    } else {
      return res.status(400).json(errorCodes.noDataProvided);
    }
  };

export const generateAccessToken = (username: string, jwtSecret: string) => {
    return jwt.sign({ id: username }, jwtSecret, {
      expiresIn: "1d",
    });
}