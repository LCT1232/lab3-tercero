// DONE: Include validation rules for create that should:
// 1. Check that restaurantId is present in the body and corresponds to an existing restaurant
// 2. Check that products is a non-empty array composed of objects with productId and quantity greater than 0
// 3. Check that products are available
// 4. Check that all the products belong to the same restaurant
// 5. Check that startedAt, sentAt and deliveredAt are not present in the body.
import { check } from 'express-validator'
import { Restaurant, Product, Order } from '../models/index.js'

const create = [
  check('startedAt').optional({ nullable: true, checkFalsy: true }).isDate(),
  check('sentAt').optional({ nullable: true, checkFalsy: true }).isDate(),
  check('deliveredAt').optional({ nullable: true, checkFalsy: true }).isDate(),
  check('price').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).toFloat(),
  check('address').exists().isString().isLength({ min: 1, max: 255 }).trim(),
  check('shippingCosts').exists().isFloat({ min: 0 }).toFloat(),
  check('restaurantId').exists().isInt({ min: 0 }).toInt(), // 1
  check('userId').exists().isInt({ min: 0 }).toInt(),
  // 1. restaurantId existe y corresponde a restaurante
  check('restaurantId')
    .exists().withMessage('restaurantId is required')
    .bail()
    .isInt({ min: 1 }).withMessage('restaurantId must be a positive integer')
    .bail()
    .custom(async (value) => {
      const restaurant = await Restaurant.findByPk(value)
      if (!restaurant) throw new Error('Restaurant does not exist')
      return true
    }),

  // 2. products es array no vacío
  check('products')
    .exists().withMessage('Products are required')
    .bail()
    .isArray({ min: 1 }).withMessage('Products must be a non-empty array'),

  // Cada producto debe tener productId y quantity > 0
  check('products.*.productId')
    .exists().withMessage('productId is required')
    .bail()
    .isInt({ min: 1 }).withMessage('productId must be a positive integer'),

  check('products.*.quantity')
    .exists().withMessage('quantity is required')
    .bail()
    .isInt({ min: 1 }).withMessage('quantity must be greater than 0'),

  // 3 & 4. Validar disponibilidad y mismo restaurante
  check('products')
    .custom(async (products, { req }) => {
      const restaurantId = req.body.restaurantId
      for (const p of products) {
        const product = await Product.findByPk(p.productId)
        if (!product) throw new Error(`Product ${p.productId} does not exist`)
        if (!product.available) throw new Error(`Product ${p.productId} is not available`)
        if (product.restaurantId !== restaurantId) throw new Error(`Product ${p.productId} does not belong to restaurant ${restaurantId}`)
      }
      return true
    })
]
// DONE: Include validation rules for update that should:
// 1. Check that restaurantId is NOT present in the body.
// 2. Check that products is a non-empty array composed of objects with productId and quantity greater than 0
// 3. Check that products are available
// 4. Check that all the products belong to the same restaurant of the originally saved order that is being edited.
// 5. Check that the order is in the 'pending' state.
// 6. Check that startedAt, sentAt and deliveredAt are not present in the body.

/**
 * Validaciones para actualizar un pedido
 */
const update = [
  // 5. No permitir timestamps
  check('startedAt').not().exists().withMessage('startedAt cannot be provided'),
  check('sentAt').not().exists().withMessage('sentAt cannot be provided'),
  check('deliveredAt').not().exists().withMessage('deliveredAt cannot be provided'),

  // Datos opcionales
  check('price').optional().isFloat({ min: 0 }).toFloat(),
  check('address').optional().isString().isLength({ min: 1, max: 255 }).trim(),
  check('shippingCosts').optional().isFloat({ min: 0 }).toFloat(),

  // 1. restaurantId NO puede estar
  check('restaurantId').not().exists().withMessage('restaurantId cannot be updated'),

  // 2. products si se envían deben ser array no vacío
  check('products')
    .optional()
    .isArray({ min: 1 }).withMessage('Products must be a non-empty array'),

  // Cada producto
  check('products.*.productId')
    .optional()
    .isInt({ min: 1 }).withMessage('productId must be a positive integer'),

  check('products.*.quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('quantity must be greater than 0'),

  // 3 & 4. Validar disponibilidad y que pertenezcan al mismo restaurante del pedido original
  check('products')
    .optional()
    .custom(async (products, { req }) => {
      if (!products) return true
      const order = await Order.findByPk(req.params.orderId)
      if (!order) throw new Error('Order not found')

      const restaurantId = order.restaurantId
      for (const p of products) {
        const product = await Product.findByPk(p.productId)
        if (!product) throw new Error(`Product ${p.productId} does not exist`)
        if (!product.available) throw new Error(`Product ${p.productId} is not available`)
        if (product.restaurantId !== restaurantId) throw new Error(`Product ${p.productId} does not belong to restaurant ${restaurantId}`)
      }
      return true
    }),

  // 5. El pedido debe estar en estado 'pending'
  check()
    .custom(async (_, { req }) => {
      const order = await Order.findByPk(req.params.orderId)
      if (!order) throw new Error('Order not found')
      if (order.status !== 'pending') throw new Error('Only pending orders can be updated')
      return true
    })
]

export { create, update }
