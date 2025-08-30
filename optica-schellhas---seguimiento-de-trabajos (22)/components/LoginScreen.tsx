
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Button, Input, Card, CardHeader, CardContent, Select } from './common/UI';
import { EyeIcon } from './common/Icons';
import { apiGetLoginUsers } from '../services/api';
import type { User } from '../types';

const LoginScreen: React.FC = () => {
  const [loginUsers, setLoginUsers] = useState<Pick<User, 'id' | 'username'>[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const { login } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const users = await apiGetLoginUsers();
            setLoginUsers(users);
        } catch (e) {
            console.error(e);
            setError("No se pudieron cargar los usuarios para el inicio de sesión.");
        } finally {
            setUsersLoading(false);
        }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
        setError('Por favor, seleccione un usuario.');
        return;
    }
    setError(null);
    setLoading(true);
    const user = await login(username, password);
    if (!user) {
      setError('Credenciales inválidas. Por favor, intente de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <EyeIcon className="h-16 w-16 mx-auto text-blue-600" />
          <h1 className="text-4xl font-bold text-gray-800 mt-2">Optica Schellhas</h1>
          <p className="text-gray-600">Sistema de Seguimiento de Trabajos</p>
        </div>
        <Card className="shadow-2xl">
          <CardHeader>
            <h2 className="text-2xl font-bold text-center text-gray-700">Iniciar Sesión</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="username-select">
                  Usuario
                </label>
                <Select
                  id="username-select"
                  value={username}
                  onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                  }}
                  required
                  disabled={usersLoading}
                >
                    <option value="" disabled>
                        {usersLoading ? "Cargando usuarios..." : "Seleccione un usuario"}
                    </option>
                    {loginUsers.map(user => (
                        <option key={user.id} value={user.username}>{user.username}</option>
                    ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  disabled={usersLoading}
                />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <div>
                <Button type="submit" className="w-full" disabled={loading || usersLoading || !username}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginScreen;