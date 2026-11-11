import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function conectarBanco() {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('🍃 MongoDB conectado');
}

export async function desconectarBanco() {
  await mongoose.disconnect();
}

export const bancoConectado = () => mongoose.connection.readyState === 1;
