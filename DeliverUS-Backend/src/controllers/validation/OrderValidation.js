import { check } from 'express-validator'
import { Order, Product, Restaurant } from '../../models/models.js'

const checkProductsAvailability = async (value, { req }) => {
  try {
    const restaurantId = req.body.restaurantId ?? (await Order.findByPk(req.params.orderId))?.restaurantId
    const products = await _getProductsFromProductLines(value, restaurantId)
    if (products.find(product => product.availability === false)) {
      return Promise.reject(new Error('Some products are not available'))
    } else {
      return Promise.resolve('Products ok')
    }
  } catch (err) {
    return Promise.reject(err)
  }
}
const checkProductsBelongToSameRestaurant = async (value, { req }) => {
  try {
    const products = await _getProductsFromProductLines(value, req.body.restaurantId)
    const productsBelongToSameRestaurant = products.length !== 0 && products.length === value.length && !products.find(product => product.restaurantId.toString() !== req.body.restaurantId.toString())
    if (productsBelongToSameRestaurant) {
      return Promise.resolve('Products ok')
    } else {
      return Promise.reject(new Error('Some products do not belong to the ordered restaurant'))
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

const checkProductsBelongToSameRestaurantAsSavedOrder = async (value, { req }) => {
  try {
    const order = await Order.findByPk(req.params.orderId, { include: { model: Product, as: 'products' } })
    const products = await _getProductsFromProductLines(value, order.restaurantId)
    const productsBelongToSameRestaurantAsSavedOrder = products.length !== 0 && products.length === value.length && !products.find(product => product.restaurantId.toString() !== order.restaurantId.toString())
    if (productsBelongToSameRestaurantAsSavedOrder) {
      return Promise.resolve('Products ok')
    } else {
      return Promise.reject(new Error('Some products do not belong to the original order restaurant'))
    }
  } catch (err) {
    return Promise.reject(err)
  }
}
const _equalProductsArraysSorting = (productsToBeSorted, sortedProductsArray) => {
  return sortedProductsArray.map(obj2 => {
    const index = productsToBeSorted.findIndex(obj1 => obj1.id.toString() === obj2.productId.toString())
    return productsToBeSorted[index]
  }).filter(product => product !== undefined)
}
const _getProductsFromProductLines = async (productLines, restaurantId) => {
  const productLinesIds = productLines.map(productLine => productLine.productId.toString())
  const restaurantWithProducts = await Restaurant.findByPk(restaurantId, { include: { model: Product, as: 'products' } })
  const products = restaurantWithProducts.products
  const productsFromProductLines = products.filter(product => productLinesIds.includes(product.id.toString()))
  return _equalProductsArraysSorting(productsFromProductLines, productLines)
}

// TODO: Include validation rules for create that should:
// 1. Check that restaurantId is present in the body and corresponds to an existing restaurant
// 2. Check that products is a non-empty array composed of objects with productId and quantity greater than 0
// 3. Check that products are available
// 4. Check that all the products belong to the same restaurant
const create = [
  check('restaurantId').exists({ checkFalsy: true }),
  check('address').exists({ checkFalsy: true }),
  check('products').exists().isArray({ min: 1 }).withMessage('Order should have products'),
  check('products.*.quantity').exists().isInt({ min: 1 }).withMessage('The quantity of the ordered products must be greater than zero').toInt(),
  check('products').custom(checkProductsBelongToSameRestaurant),
  check('products').custom(checkProductsAvailability),
  check('startedAt').not().exists(),
  check('sentAt').not().exists(),
  check('deliveredAt').not().exists()
]
// TODO: Include validation rules for update that should:
// 1. Check that restaurantId is NOT present in the body.
// 2. Check that products is a non-empty array composed of objects with productId and quantity greater than 0
// 3. Check that products are available
// 4. Check that all the products belong to the same restaurant of the originally saved order that is being edited.
// 5. Check that the order is in the 'pending' state.
const update = [
  check('restaurantId').not().exists(),
  check('address').exists({ checkFalsy: true }),
  check('products').exists().isArray({ min: 1 }).withMessage('Order should have products'),
  check('products.*.quantity').exists().isInt({ min: 1 }).withMessage('The quantity of the ordered products must be greater than zero').toInt(),
  check('products').custom(checkProductsBelongToSameRestaurantAsSavedOrder),
  check('products').custom(checkProductsAvailability),
  check('startedAt').not().exists(),
  check('sentAt').not().exists(),
  check('deliveredAt').not().exists()
]

export { create, update }
