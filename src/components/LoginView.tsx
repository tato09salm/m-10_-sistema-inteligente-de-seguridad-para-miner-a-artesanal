import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  HardHat, 
  Zap, 
  Database, 
  Cpu, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { SystemUser } from '../types';
import { api } from '../lib/api';

interface LoginViewProps {
  onLoginSuccess: (user: SystemUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
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
    <div className="min-h-screen bg-[#0A0C0E] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C1F26] via-[#0F1115] to-[#0A0C0E] text-gray-100 flex flex-col justify-between selection:bg-[#D4AF37] selection:text-black">
      
      {/* Top Brand Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/5 bg-[#121418]/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B38B21] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 border border-[#FFE885]/40">
            <HardHat className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 tracking-wider">
                M-10
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Sistema Inteligente de Seguridad Minera
              </h1>
            </div>
            <p className="text-[11px] text-gray-400">Plataforma Telemática de Detección de Caídas e Inmovilidad</p>
          </div>
        </div>

        {/* Live Badges */}
        <div className="hidden sm:flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">PostgreSQL: Conectado</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">FastAPI + ML v3.2</span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          
          {/* Card Container */}
          <div className="relative bg-[#14171D]/90 backdrop-blur-xl border border-[#D4AF37]/20 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80">
            
            {/* Top Amber Glow Bar */}
            <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            
            {/* Title & Icon */}
            <div className="text-center mb-7">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#1A1E26] border border-[#D4AF37]/30 flex items-center justify-center shadow-inner group">
                <ShieldAlert className="w-7 h-7 text-[#D4AF37] group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Acceso de Supervisión</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Ingrese sus credenciales autorizadas de guardia subterránea
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-200">Fallo de Autenticación</p>
                  <p className="mt-0.5 text-red-300/90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F1115] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
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
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0F1115] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200 transition-colors"
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
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#D4AF37]" />
                  Credenciales Preconfiguradas
                </span>
                <button
                  type="button"
                  id="btn-fill-demo-credentials"
                  onClick={handleFillDemo}
                  className="text-[11px] text-[#D4AF37] hover:underline font-medium cursor-pointer"
                >
                  Autocompletar
                </button>
              </div>

              <div 
                onClick={handleFillDemo}
                className="p-3 rounded-xl bg-[#0F1115] border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="text-xs space-y-0.5 font-mono">
                  <p className="text-gray-300">
                    <span className="text-gray-500">Correo:</span> <strong className="text-[#D4AF37]">mineria@minerio</strong>
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-500">Clave:</span> <strong className="text-gray-200">mineria123</strong>
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] font-semibold group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">
                  Usar
                </span>
              </div>
            </div>

          </div>

          {/* Bottom Security Footer */}
          <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
            <p className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Base de Datos PostgreSQL (mineria:5432) Activa</span>
            </p>
            <p>© 2026 M-10 Proyecto Seguridad y Salud Ocupacional en Minería Subterránea</p>
          </div>

        </div>
      </main>

      {/* Subtle Bottom Bar */}
      <footer className="py-3 px-6 text-center text-[11px] text-gray-600 border-t border-white/5">
        <span>Transmisión encriptada vía protocolo REST / WebSockets • Telemetría acelerométrica y giroscópica</span>
      </footer>

    </div>
  );
};
