import { Request, Response } from "express";
import * as orderService from "../services/order.service";
import { createApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

// ✅ CREATE ORDER
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrderService(req.body);

  res
    .status(201)
    .json(createApiResponse(201, order, "Order created successfully"));
});

// ✅ GET SINGLE ORDER
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderService(req.params.id as string);

  res
    .status(200)
    .json(createApiResponse(200, order, "Order retrieved successfully"));
});

// ✅ LIST ORDERS (FILTER + PAGINATION)
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await orderService.listOrdersService(req.query);

  res
    .status(200)
    .json(
      createApiResponse(200, data, "Orders fetched successfully", pagination),
    );
});

// ✅ UPDATE ORDER
export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderService(
    req.params.id as string,
    req.body,
  );

  res
    .status(200)
    .json(createApiResponse(200, order, "Order updated successfully"));
});

// ✅ DELETE ORDER (SOFT DELETE)
export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  await orderService.deleteOrderService(req.params.id as string);

  res
    .status(200)
    .json(createApiResponse(200, null, "Order deleted successfully"));
});

//Reorder Order
export const reorder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.reorderService(
    req.params.id as string,
    req.body.paymentMethod,
    req.body.paymentStatus,
  );

  res
    .status(201)
    .json(createApiResponse(201, order, "Order reordered successfully"));
});
