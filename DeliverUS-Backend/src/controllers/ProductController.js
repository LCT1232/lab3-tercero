import { Product, ProductCategory } from '../models/models.js'
import Sequelize from 'sequelize'

const indexRestaurant = async function (req, res) {
  try {
    const products = await Product.findAll({
      where: {
        restaurantId: req.params.restaurantId
      },
      include: [
        {
          model: ProductCategory,
          as: 'productCategory'
        }]
    })
    res.json(products)
  } catch (err) {
    res.status(500).send(err)
  }
}

const show = async function (req, res) {
  // Only returns PUBLIC information of products
  try {
    const product = await Product.findByPk(req.params.productId, {
      include: [
        {
          model: ProductCategory,
          as: 'productCategory'
        }]
    }
    )
    res.json(product)
  } catch (err) {
    res.status(500).send(err)
  }
}

const create = async function (req, res) {
  let newProduct = Product.build(req.body)
  try {
    newProduct = await newProduct.save()
    res.json(newProduct)
  } catch (err) {
    res.status(500).send(err)
  }
}

const update = async function (req, res) {
  try {
    await Product.update(req.body, { where: { id: req.params.productId } })
    const updatedProduct = await Product.findByPk(req.params.productId)
    res.json(updatedProduct)
  } catch (err) {
    res.status(500).send(err)
  }
}

const destroy = async function (req, res) {
  try {
    const result = await Product.destroy({ where: { id: req.params.productId } })
    let message = ''
    if (result === 1) {
      message = 'Successfully deleted product id.' + req.params.productId
    } else {
      message = 'Could not delete product.'
    }
    res.json(message)
  } catch (err) {
    res.status(500).send(err)
  }
}

const popular = async function (req, res) {
  try {
    const topProducts = await Product.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(`(
              SELECT COALESCE(SUM(quantity), 0)
              FROM OrderProducts
              WHERE OrderProducts.ProductId = Product.id
            )`),
            'soldProductCount'
          ]
        ]
      },
      order: [
        [Sequelize.literal('soldProductCount'), 'DESC']
      ],
      limit: 3 // Solo los 3 primeros
    })

    res.json(topProducts)
  } catch (err) {
    res.status(500).send(err)
  }
}

const ProductController = {
  indexRestaurant,
  show,
  create,
  update,
  destroy,
  popular
}
export default ProductController
