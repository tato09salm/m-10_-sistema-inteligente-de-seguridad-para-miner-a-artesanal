import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  HardHat, 
  Zap, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { SystemUser } from '../types';
import { api } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';
import fondoMineria from '../assets/fondoMineria.png';

interface LoginViewProps {
  onLoginSuccess: (user: SystemUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('mineria@minerio');
  const [password, setPassword] = useState('mineria123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await api.login({ email, password });
      if (response && response.success) {
        onLoginSuccess(response.user);
      } else {
        setErrorMessage('Credenciales no válidas para el sistema.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor FastAPI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('mineria@minerio');
    setPassword('mineria123');
    setErrorMessage(null);
  };

  return (
    <div 
      className="min-h-screen relative flex flex-col justify-between selection:bg-[#D4AF37] selection:text-black bg-cover bg-center bg-no-repeat overflow-hidden"
      style={{ backgroundImage: `url(${fondoMineria})` }}
    >
      {/* Luminous / Dark Adaptive Overlay */}
      {theme === 'dark' ? (
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090C]/85 via-[#0B0D12]/75 to-[#07090C]/90 backdrop-blur-[2px] z-0 pointer-events-none" />
      ) : (
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[0.5px] z-0 pointer-events-none" />
      )}

      {/* Top Floating Controls - Clean & Minimalist */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B38B21] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 border ${
          theme === 'dark' ? 'border-[#FFE885]/40' : 'border-[#D4AF37]/50'
        } backdrop-blur-md`}>
          <HardHat className="w-6 h-6 text-black" />
        </div>

        <button
          id="btn-login-toggle-theme"
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          className={`px-3 py-1.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-2 shadow-lg cursor-pointer text-xs font-medium ${
            theme === 'dark'
              ? 'bg-black/40 border border-white/15 text-[#D4AF37] hover:border-[#D4AF37]/60 hover:bg-black/60'
              : 'bg-white/85 border border-[#D4AF37]/35 text-[#854D0E] hover:border-[#D4AF37] hover:bg-white shadow-md'
          }`}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-[#FEDB72]" />
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-[#B45309]" />
              <span>Modo Oscuro</span>
            </>
          )}
        </button>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          
          {/* Card Container */}
          <div className={`relative rounded-2xl p-6 sm:p-8 shadow-2xl transition-all ${
            theme === 'dark'
              ? 'bg-[#14171D]/90 backdrop-blur-xl border border-[#D4AF37]/25 shadow-black/90'
              : 'bg-white/95 backdrop-blur-xl border border-[#D4AF37]/35 shadow-xl shadow-[#D4AF37]/15'
          }`}>
            
            {/* Top Amber Glow Bar */}
            <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            
            {/* Title & Icon */}
            <div className="text-center mb-7">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl border flex items-center justify-center shadow-inner group ${
                theme === 'dark'
                  ? 'bg-[#1A1E26] border-[#D4AF37]/30'
                  : 'bg-[#FFFBEB] border-[#D4AF37]/40'
              }`}>
                <ShieldAlert className="w-7 h-7 text-[#D4AF37] group-hover:scale-110 transition-transform" />
              </div>
              <h2 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Acceso de Supervisión
              </h2>
              <p className={`text-xs sm:text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                Ingrese sus credenciales autorizadas de guardia subterránea
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Fallo de Autenticación</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-slate-700'
                }`}>
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-email"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ej. mineria@minerio"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono border ${
                      theme === 'dark'
                        ? 'bg-[#0F1115] border-white/10 text-white placeholder-gray-500'
                        : 'bg-[#F8FAFC] border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`block text-xs font-semibold uppercase tracking-wider ${
                    theme === 'dark' ? 'text-gray-300' : 'text-slate-700'
                  }`}>
                    Contraseña
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full pl-10 pr-11 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono border ${
                      theme === 'dark'
                        ? 'bg-[#0F1115] border-white/10 text-white placeholder-gray-500'
                        : 'bg-[#F8FAFC] border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#E5C158] hover:to-[#D4AF37] text-black font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Verificando Credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar al Centro de Mando</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

            {/* Quick Demo Credentials Box */}
            <div className={`mt-6 pt-5 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-slate-600'
                }`}>
                  <Zap className="w-3 h-3 text-[#D4AF37]" />
                  Credenciales Preconfiguradas
                </span>
                <button
                  type="button"
                  id="btn-fill-demo-credentials"
                  onClick={handleFillDemo}
                  className="text-[11px] text-[#B45309] dark:text-[#D4AF37] hover:underline font-semibold cursor-pointer"
                >
                  Autocompletar
                </button>
              </div>

              <div 
                onClick={handleFillDemo}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                  theme === 'dark'
                    ? 'bg-[#0F1115] border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                    : 'bg-[#FFFDF7] border-[#D4AF37]/35 hover:border-[#D4AF37] shadow-sm'
                }`}
              >
                <div className="text-xs space-y-0.5 font-mono">
                  <p className={theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}>
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}>Correo:</span> <strong className="text-[#B45309] dark:text-[#D4AF37]">mineria@minerio</strong>
                  </p>
                  <p className={theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}>
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}>Clave:</span> <strong className={theme === 'dark' ? 'text-gray-200' : 'text-slate-900'}>mineria123</strong>
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#B45309] dark:text-[#D4AF37] font-semibold group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">
                  Usar
                </span>
              </div>
            </div>

          </div>

          {/* Bottom Security Footer */}
          <div className={`mt-6 text-center text-xs space-y-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600 font-medium'}`}>
            <p className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Base de Datos PostgreSQL (mineria:5432) Activa</span>
            </p>
            <p>© 2026 M-10 Proyecto Seguridad y Salud Ocupacional en Minería Subterránea</p>
          </div>

        </div>
      </main>

      {/* Subtle Bottom Bar */}
      <footer className={`py-3 px-6 text-center text-[11px] border-t ${
        theme === 'dark' ? 'text-gray-500 border-white/5' : 'text-slate-600 border-slate-200/60 bg-white/40 backdrop-blur-sm'
      }`}>
        <span>Transmisión encriptada vía protocolo REST / WebSockets • Telemetría acelerométrica y giroscópica</span>
      </footer>

    </div>
  );
};
