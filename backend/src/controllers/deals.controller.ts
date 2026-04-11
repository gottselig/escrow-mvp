import { Request, Response } from 'express'

export const getDeals = (req: Request, res: Response) => {
  res.json({ deals: [] })
}

export const createDeal = (req: Request, res: Response) => {
  res.json({ message: 'Deal created' })
}
