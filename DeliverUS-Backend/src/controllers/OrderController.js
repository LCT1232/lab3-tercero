import { Order, Product, Restaurant, User, sequelizeSession } from '../models/models.js'
import moment from 'moment'
import { Op } from 'sequelize'
const generateFilterWhereClauses = function (req) { // función que filtra los pedidos según su estado (fecha)
  const filterWhereClauses = []
  if (req.query.status) {
    switch (req.query.status) {
      case 'pending':
        filterWhereClauses.push({
          startedAt: null
        })
        break
      case 'in process':
        filterWhereClauses.push({
          [Op.and]: [
            {
              startedAt: {
                [Op.ne]: null
              }
            },
            { sentAt: null },
            { deliveredAt: null }
          ]
        })
        break
      case 'sent':
        filterWhereClauses.push({
          [Op.and]: [
            {
              sentAt: {
                [Op.ne]: null
              }
            },
            { deliveredAt: null }
          ]
        })
        break
      case 'delivered':
        filterWhereClauses.push({
          sentAt: {
            [Op.ne]: null
          }
        })
        break
    }
  }
  if (req.query.from) {
    const date = moment(req.query.from, 'YYYY-MM-DD', true)
    filterWhereClauses.push({
      createdAt: {
        [Op.gte]: date
      }
    })
  }
  if (req.query.to) {
    const date = moment(req.query.to, 'YYYY-MM-DD', true)
    filterWhereClauses.push({
      createdAt: {
        [Op.lte]: date.endOf('day') // [Op.lte]: date.add(1, 'days'): incluiría las 00:00 de otro día
      }
    })
  }
  return filterWhereClauses
}
// Returns :restaurantId orders
const indexRestaurant = async function (req, res) {
  const whereClauses = generateFilterWhereClauses(req)
  whereClauses.push({
    restaurantId: req.params.restaurantId
  })
  try {
    const orders = await Order.findAll({
      where: whereClauses,
      include: {
        model: Product,
        as: 'products'
      }
    })
    res.json(orders)
  } catch (err) {
    res.status(500).send(err)
  }
}
// DONE: Implement the indexCustomer function that queries orders from current logged-in customer and send them back.
const indexCustomer = async function (req, res) {
  try {
    const orders = await Order.findAll({
      attributes: { exclude: ['restaurantId'] },
      where: { userId: req.user.id }, // pedidos del cliente logueado
      include: [
        { model: Product, as: 'products' }, // incluir productos
        { model: Restaurant, as: 'restaurant' } // incluir restaurante
      ],
      order: [['createdAt', 'DESC']] // ordenado por fecha de creación descendente
    })
    res.json(orders)
  } catch (err) {
    res.status(500).send(err)
  }
}
// DONE: Implement the create function that receives a new order and stores it in the database.
const create = async function(req, res) {
  const t = await sequelize.transaction() // usando transacción
  try {
    const restaurant = await Restaurant.findByPk(req.body.restaurantId) // vemos id del restaurante donde se quiere crear pedido
    const newOrder = Order.build(req.body) // creamos el pedido
    newOrder.userId = req.user.id // asignamos userId 
    if (newOrder.price > 10) { // shipping rules
      newOrder.shippingCosts = 0
    } else {
      newOrder.shippingCosts = restaurant.shippingCosts
      newOrder.price = newOrder.price + restaurant.shippingCosts
    }
    const order = await newOrder.save({ transaction: t }) // guardar pedido
    // guardar productos del pedido
    for (const p of req.body.products) { // para cada producto p del pedido
      await OrderProducts.create({ // creamos el producto
        orderId: order.id,
        productId: p.productId,
        quantity: p.quantity
      }, { transaction: t })
    }
    await t.commit() // si todo va bien se hace commit
    res.json(order)
  } catch (err) {
    await t.rollback() // si hay error se hace rollback
    res.status(500).send(err)
  }
}
// DONE: Implement the update function that receives a modified order and persists it in the database.
/*
update = hacer lo mismo que en create, pero con dos diferencias clave:
  - actualiza el pedido actual
  - borra los productos antiguos y guarda los nuevos
Flujo
1. update order
2. delete old OrderProducts
3. insert new OrderProducts
4. commit
5. rollback if error
*/
const update = async function (req, res) {
  const t = await sequelize.transaction() // inicio de transacción
  try {
    const order = await Order.findByPk(req.params.orderId, { transaction: t }) // buscar orden 
    const restaurant = await Restaurant.findByPk(req.body.restaurantId) // buscar restaurante
    order.set(req.body) // actualizar datos del pedido
    if (order.price > 10) { // mismas condiciones del create
      order.shippingCosts = 0
    } else {
      order.shippingCosts = restaurant.shippingCosts
      order.price = order.price + restaurant.shippingCosts
    }
    await order.save({ transaction: t }) // guarda nuevo pedido
    await OrderProducts.destroy({ // eliminar productos antiguos del pedido
      where: { orderId: order.id },
      transaction: t
    })
    for (const p of req.body.products) { // guardar nuevos productos
      await OrderProducts.create({
        orderId: order.id,
        productId: p.productId,
        quantity: p.quantity
      }, { transaction: t })
    }
    await t.commit() // commit si todo va bien
    res.json(order)
  } catch (err) {
    await t.rollback()
    res.status(500).send(err)
  }
}

// DONE: Implement the destroy function that receives an orderId as path param and removes the associated order from the database.
const destroy = async function (req, res) {
  try {
    await Order.destroy({ where: { id: req.params.orderId }})
    res.json('deleted')
  } catch (err) {
    res.status(500).send(err)
  }
}

const confirm = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId)
    order.startedAt = new Date()
    const updatedOrder = await order.save()
    res.json(updatedOrder)
  } catch (err) {
    res.status(500).send(err)
  }
}

const send = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId)
    order.sentAt = new Date()
    const updatedOrder = await order.save()
    res.json(updatedOrder)
  } catch (err) {
    res.status(500).send(err)
  }
}

const deliver = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId)
    order.deliveredAt = new Date()
    const updatedOrder = await order.save()
    const restaurant = await Restaurant.findByPk(order.restaurantId)
    const averageServiceTime = await restaurant.getAverageServiceTime()
    await Restaurant.update({ averageServiceMinutes: averageServiceTime }, { where: { id: order.restaurantId } })
    res.json(updatedOrder)
  } catch (err) {
    res.status(500).send(err)
  }
}

const show = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: [{
        model: Restaurant,
        as: 'restaurant',
        attributes: ['name', 'description', 'address', 'postalCode', 'url', 'shippingCosts', 'averageServiceMinutes', 'email', 'phone', 'logo', 'heroImage', 'status', 'restaurantCategoryId']
      },
      {
        model: User,
        as: 'user',
        attributes: ['firstName', 'email', 'avatar', 'userType']
      },
      {
        model: Product,
        as: 'products'
      }]
    })
    res.json(order)
  } catch (err) {
    res.status(500).send(err)
  }
}

// calcula estadísticas de pedidos de un restaurante
const analytics = async function (req, res) {
  const yesterdayZeroHours = moment().subtract(1, 'days').set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  const todayZeroHours = moment().set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  try {
    const numYesterdayOrders = await Order.count({ // devuelve el numero de pedidos del día anterior
      where:
      {
        createdAt: {
          [Op.lt]: todayZeroHours,
          [Op.gte]: yesterdayZeroHours
        },
        restaurantId: req.params.restaurantId
      }
    })
    const numPendingOrders = await Order.count({ // devuelve el numero de pedidos pendientes
      where:
      {
        startedAt: null,
        restaurantId: req.params.restaurantId
      }
    })
    const numDeliveredTodayOrders = await Order.count({ // numero de pedidos entregados del dia 
      where:
      {
        deliveredAt: { [Op.gte]: todayZeroHours },
        restaurantId: req.params.restaurantId
      }
    })
    const invoicedToday = await Order.sum( // beneficios del dia
      'price',
      {
        where:
        {
          deliveredAt: { [Op.gte]: todayZeroHours }, // contamos facturado cuando el pedido esté entregado, en consecuencia, pagado
          restaurantId: req.params.restaurantId
        }
      })
    res.json({
      restaurantId: req.params.restaurantId,
      numYesterdayOrders,
      numPendingOrders,
      numDeliveredTodayOrders,
      invoicedToday
    })
  } catch (err) {
    res.status(500).send(err)
  }
}

const OrderController = {
  indexRestaurant,
  indexCustomer,
  create,
  update,
  destroy,
  confirm,
  send,
  deliver,
  show,
  analytics
}
export default OrderController
