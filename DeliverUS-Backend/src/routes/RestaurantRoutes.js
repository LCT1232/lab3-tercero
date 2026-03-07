import OrderController from '../controllers/OrderController.js'
import ProductController from '../controllers/ProductController.js'
import RestaurantController from '../controllers/RestaurantController.js'
/*
is it needed that a user is logged in?
is it needed that the user has a particular role?
may the data include files?
is it needed that the restaurant belongs to the logged-in user? (restaurant data should include a userId which belongs to the owner of that restaurant)
is it needed that the restaurant data include valid values for each property in order to be created according to our information requirements?
*/
// TODO: implementar las rutas añadiendo middlewares y validación
const loadFileRoutes = function (app) {
  app.route('/restaurants')
    .get( // buscar restaurante
      isLoggedIn,
      RestaurantController.index)
    .post( // crear restaurante
      isLoggedIn,
      handleFilesUpload(['image'], process.env.RESTAURANTS_FOLDER),
      RestaurantValidation.create,
      handleValidation,
      RestaurantController.create)

  app.route('/restaurants/:restaurantId')
    .get( // buscar restaurante por id
      RestaurantController.show)
    .put( // actualizar restaurante
      isLoggedIn,
      hasRole('owner'),
      handleFilesUpload(['image'], process.env.RESTAURANTS_FOLDER),
      RestaurantValidation.update,
      handleValidation,
      RestaurantMiddleware.checkRestaurantOwnership,
      RestaurantController.update)
    .delete( // eliminar restaurante
      isLoggedIn,
      hasRole('owner'),
      RestaurantMiddleware.checkRestaurantOwnership,
      RestaurantController.destroy)

  app.route('/restaurants/:restaurantId/orders')
    .get( // buscar pedidos de un restaurante, suponiendo pedidos de cliente
      isLoggedIn,
      OrderMiddleware.checkOrderCustomer, // mi pedido tiene mi id
      OrderMiddleware.checkRestaurantExists, // existe el restuarante donde he pedido
      OrderController.indexRestaurant)

  app.route('/restaurants/:restaurantId/products')
    .get( // buscar productos de un restaurante, siendo cliente
      isLoggedIn,
      ProductController.indexRestaurant)

  app.route('/restaurants/:restaurantId/analytics')
    .get(
      isLoggedIn,
      OrderController.analytics)
}
export default loadFileRoutes
