import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarUsuarioInput,
  CrearUsuarioInput,
  LoginInput,
  Usuario,
  UsuarioAutenticado,
} from './user.types.js';
import { usuarioRepository } from './user.repository.js';

/**
 * Elimina el campo hash_contra del objeto para no exponerlo en la API.
 */
function usuarioSinHash(usuario: Usuario): Usuario {
  const { hash_contra: _hash, ...usuarioSeguro } = usuario;
  return usuarioSeguro as Usuario;
}

/**
 * Lógica de negocio del módulo de usuarios.
 * Orquesta validaciones, hashing y emisión de tokens JWT.
 */
export const usuarioService = {
  /**
   * Registra un nuevo usuario. Lanza un conflicto si el email ya existe.
   */
  async registrar(input: CrearUsuarioInput): Promise<Usuario> {
    const existente = await usuarioRepository.buscarPorEmail(input.email);
    if (existente) {
      throw ApiError.conflict('Ya existe un usuario con ese email');
    }

    const hashContrasena = await bcrypt.hash(input.password, 10);
    const usuario = await usuarioRepository.crear(input, hashContrasena);
    return usuarioSinHash(usuario);
  },

  /**
   * Lista todos los usuarios.
   */
  async listar(): Promise<Usuario[]> {
    const usuarios = await usuarioRepository.listar();
    return usuarios.map(usuarioSinHash);
  },

  /**
   * Inicia sesión validando credenciales y emitiendo un token JWT.
   * Rechaza usuarios inactivos.
   */
  async login(input: LoginInput) {
    const usuario = await usuarioRepository.buscarPorEmail(input.email);
    if (!usuario) {
      throw ApiError.unauthorized('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw ApiError.forbidden('El usuario está desactivado');
    }

    const contraValida = await bcrypt.compare(input.password, usuario.hash_contra);
    if (!contraValida) {
      throw ApiError.unauthorized('Credenciales inválidas');
    }

    const autenticado: UsuarioAutenticado = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };

    const token = jwt.sign(autenticado, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return { token, usuario: autenticado };
  },

  /**
   * Obtiene los datos de un usuario por id.
   */
  async obtenerPorId(id: string): Promise<Usuario> {
    const usuario = await usuarioRepository.buscarPorId(id);
    if (!usuario) {
      throw ApiError.notFound('Usuario no encontrado');
    }
    return usuarioSinHash(usuario);
  },

  /**
   * Actualiza un usuario por id.
   * Si se cambia el email, valida que no exista otro usuario con él.
   */
  async actualizar(id: string, input: ActualizarUsuarioInput): Promise<Usuario> {
    // Validar unicidad del email si se intenta cambiar.
    if (input.email !== undefined) {
      const existente = await usuarioRepository.buscarPorEmail(input.email);
      if (existente && existente.id !== id) {
        throw ApiError.conflict('Ya existe otro usuario con ese email');
      }
    }

    // Se construye el objeto de datos para el repositorio, excluyendo password.
    const datosDb: {
      nombre?: string;
      email?: string;
      hashContra?: string;
      rol?: string;
      activo?: boolean;
    } = {
      nombre: input.nombre,
      email: input.email,
      rol: input.rol,
      activo: input.activo,
    };

    // Si se proporciona una contraseña nueva, se calcula su hash.
    if (input.password !== undefined) {
      datosDb.hashContra = await bcrypt.hash(input.password, 10);
    }

    const actualizado = await usuarioRepository.actualizar(id, datosDb);
    if (!actualizado) {
      throw ApiError.notFound('Usuario no encontrado');
    }
    return usuarioSinHash(actualizado);
  },

  /**
   * Elimina un usuario por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminado = await usuarioRepository.eliminar(id);
    if (!eliminado) {
      throw ApiError.notFound('Usuario no encontrado');
    }
  },
};
