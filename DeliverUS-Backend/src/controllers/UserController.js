import { User, Restaurant } from '../models/models.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import moment from 'moment'

const indexWithRestaurants = async (req, res) => {
  try {
    const users = await User.findAll({ include: Restaurant })
    res.json(users)
  } catch (err) {
    res.status(500).send(err)
  }
}

const registerCustomer = async (req, res) => {
  await _register(req, res, 'customer')
}

const registerOwner = async (req, res) => {
  await _register(req, res, 'owner')
}

const findByToken = async (token) => {
  const foundUser = await User.findOne({ where: { token } }, { attributes: { exclude: ['password'] } })
  if (!foundUser) {
    throw new Error('Token not valid')
  }
  if (foundUser.tokenExpiration < new Date()) {
    throw new Error('Token expired.')
  }
  return await _updateExpirationToken(foundUser)
}

const isTokenValid = async (req, res) => {
  try {
    res.json(await findByToken(req.body.token))
  } catch (err) {
    return res.status(403).send({ errors: err.message })
  }
}

const loginOwner = (req, res) => {
  _login(req, res, 'owner')
}

const loginCustomer = (req, res) => {
  _login(req, res, 'customer')
}

const show = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: ['id', 'firstName', 'email', 'avatar', 'userType']
    })
    res.json(user)
  } catch (err) {
    res.status(500).send(err)
  }
}

const update = async (req, res) => {
  try {
    await User.update(req.body, { where: { id: req.user.id } })
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } })// update method does not return updated row(s)
    res.json(user)
  } catch (err) {
    res.status(500).send(err)
  }
}

const destroy = async (req, res) => {
  try {
    const result = await User.destroy({ where: { id: req.user.id } })
    let message = ''
    if (result === 1) {
      message = 'Successfully deleted.'
    } else {
      message = 'Could not delete user.'
    }
    res.json(message)
  } catch (err) {
    res.status(500).send(err)
  }
}

const _register = async (req, res, userType) => {
  try {
    req.body.userType = userType
    const newUser = new User(req.body)
    const registeredUser = await newUser.save()
    const updatedUser = await _updateToken(registeredUser.id, _createUserTokenDTO())
    res.json(updatedUser)
  } catch (err) {
    if (err.name.includes('ValidationError') || err.name.includes('SequelizeUniqueConstraintError')) {
      res.status(422).send(err)
    } else {
      res.status(500).send(err)
    }
  }
}

const _login = async function (req, res, userType) {
  try {
    const user = await User.findOne({ where: { email: req.body.email, userType } })
    if (!user) {
      res.status(401).send({ errors: [{ param: 'login', msg: 'Wrong credentials' }] })
    } else {
      const passwordValid = await bcrypt.compare(req.body.password, user.password)
      if (!passwordValid) {
        res.status(401).send({ errors: [{ param: 'login', msg: 'Wrong credentials' }] })
      } else {
        if (user.token && user.tokenExpiration > new Date()) {
          const { password, ...userWithoutPassword } = user.toJSON()
          res.json(userWithoutPassword)
        } else {
          const updatedUser = await _updateToken(user.id, _createUserTokenDTO())
          res.json(updatedUser)
        }
      }
    }
  } catch (err) {
    res.status(401).send(err)
  }
}

const _updateToken = async (id, tokenDTO, ...args) => {
  const user = await User.findByPk(id, {
    attributes: { exclude: ['password'] }
  })
  user.set(tokenDTO)
  return user.save()
}

const _createUserTokenDTO = () => {
  return {
    token: crypto.randomBytes(20).toString('hex'),
    tokenExpiration: moment().add(7, 'days').toDate()
  }
}

const _updateExpirationToken = async (user) => {
  user.tokenExpiration = moment().add(7, 'days').toDate()
  return user.save()
}

const UserController = {
  indexWithRestaurants,
  registerCustomer,
  registerOwner,
  findByToken,
  isTokenValid,
  loginOwner,
  loginCustomer,
  show,
  update,
  destroy
}

export default UserController
