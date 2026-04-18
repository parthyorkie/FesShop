import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import { asyncHandler } from '../utils/asyncHandler';
import { createApiResponse } from '../utils/ApiResponse';

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProductService(req.body);
  res.status(201).json(createApiResponse(201, product, 'Product created successfully'));
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getProductService(req.params.id as string);
  res.status(200).json(createApiResponse(200, product, 'Product retrieved successfully'));
});

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await productService.listProductsService(req.query);
  res.status(200).json(createApiResponse(200, data, 'Products fetched successfully', pagination));
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.updateProductService(req.params.id as string, req.body);
  res.status(200).json(createApiResponse(200, product, 'Product updated successfully'));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProductService(req.params.id as string);
  res.status(200).json(createApiResponse(200, null, 'Product deleted successfully'));
});
