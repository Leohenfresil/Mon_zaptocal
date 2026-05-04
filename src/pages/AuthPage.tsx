import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setConfirmationMessage(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      alert('Erro de configuração: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não foram configurados.');
      setLoading(false);
      return;
    }

    try {
      console.log('Iniciando autenticação...');
      if (isLogin) {
        console.log('Chamando signInWithPassword...');
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        console.log('Resultado signIn:', { error, data });
        if (error) throw error;
        console.log('Login bem-sucedido, redirecionando...');
        navigate('/');
      } else {
        console.log('Chamando signUp...');
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        console.log('Resultado signUp:', { error, data });
        if (error) throw error;
        console.log('SignUp bem-sucedido!');
        setConfirmationMessage('E-mail enviado! Verifique sua caixa de entrada para confirmar a conta.');
      }
    } catch (err: any) {
      console.error('Erro de autenticação:', err);
      alert(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      console.log('Finalizando autenticação (finally block)...');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-white mb-6">
          {isLogin ? 'Entrar' : 'Registrar'}
        </h2>
        {confirmationMessage && (
          <div className="mb-4 p-3 bg-blue-900 border border-blue-700 text-blue-100 rounded-lg text-sm">
            {confirmationMessage}
          </div>
        )}
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium"
          >
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Registrar')}
          </button>
        </form>
        <button
          onClick={() => {setIsLogin(!isLogin); setConfirmationMessage(null);}}
          className="w-full mt-4 text-gray-400 text-sm hover:text-white"
        >
          {isLogin ? 'Não tem conta? Registre-se' : 'Já tem conta? Entre'}
        </button>
      </motion.div>
    </div>
  );
}
