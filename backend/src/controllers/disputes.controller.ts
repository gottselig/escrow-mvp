import { Request, Response } from 'express'

export const getDisputes = (req: Request, res: Response) => {
  res.json({ disputes: [] })
}

export const createDispute = (req: Request, res: Response) => {
  res.json({ message: 'Dispute created' })
}
