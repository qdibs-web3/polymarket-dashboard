import { motion, Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Zap, TrendingUp, ShieldCheck, Clock, Brain, Target, CheckCircle, Sparkles, Award } from 'lucide-react';

interface SubscriptionUpgradeProps {
  onUpgradeClick: () => void;
}

const SubscriptionUpgrade = ({ onUpgradeClick }: SubscriptionUpgradeProps) => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: 0.08, 
        delayChildren: 0.1 
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: 'spring' as const, 
        stiffness: 100 
      } 
    },
  };

  const floatVariants: Variants = {
    initial: { y: 0 },
    animate: {
      y: [-3, 3, -3],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const pulseVariants: Variants = {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div
      className="relative bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 text-white p-12 rounded-lg shadow-2xl border border-blue-500/30 min-h-[85vh] overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Animated Background Elements */}
      <motion.div 
        className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div 
        className="absolute bottom-20 left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2.5
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Hero Section */}
        <motion.div className="text-center mb-8" variants={itemVariants}>
          <motion.div
            variants={floatVariants}
            initial="initial"
            animate="animate"
          >
            <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-teal-300 to-blue-400">
              Unlock Your Trading Potential
            </h1>
          </motion.div>
          <p className="text-2xl text-gray-300 mb-3">
            Stop leaving money on the table. Let our AI-powered bot trade for you 24/7.
          </p>
          <motion.p 
            className="text-base text-blue-400 font-semibold flex items-center justify-center gap-2"
            variants={pulseVariants}
            initial="initial"
            animate="animate"
          >
            <Sparkles className="h-5 w-5" />
            Join 500+ traders already earning passive income on Polymarket
            <Sparkles className="h-5 w-5" />
          </motion.p>
        </motion.div>

        {/* CTA Section - Compact with Right-Aligned Button */}
        <motion.div 
          className="mb-10 p-6 bg-gray-800/40 rounded-xl border border-gray-700"
          variants={itemVariants}
          whileHover={{ borderColor: "rgba(59, 130, 246, 0.5)" }}
        >
          <div className="flex items-center gap-6">
            {/* Left: Text Content */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2 text-left">Start Earning Passive Income Today</h2>
              <p className="text-base text-gray-300 mb-3 text-left">Choose a plan that fits your trading goals and get started in minutes</p>
              
              <div className="flex items-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>30-Day Guarantee</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Cancel Anytime</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>No Setup Fees</span>
                </div>
              </div>
            </div>

            {/* Right: Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex-shrink-0"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white text-lg font-bold px-8 py-6 rounded-lg shadow-2xl"
                onClick={onUpgradeClick}
              >
                <motion.span
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex items-center gap-2"
                >
                  <Award className="h-6 w-6" />
                  View Plans & Start Trading
                </motion.span>
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Performance Metrics - Unified Colors */}
        <motion.div
          className="mb-10 p-8 bg-gray-800/40 rounded-xl border border-gray-700"
          variants={itemVariants}
          whileHover={{ borderColor: "rgba(59, 130, 246, 0.5)" }}
        >
          <h2 className="text-3xl font-bold mb-6 text-center">Live Performance Metrics</h2>
          
          <div className="grid grid-cols-5 gap-6 mb-6">
            <motion.div
              className="text-center"
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.p 
                className="text-5xl font-bold text-blue-400 mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              >
                15%
              </motion.p>
              <p className="text-base text-gray-300 font-medium">Avg. Monthly Return</p>
            </motion.div>
            
            <motion.div
              className="text-center"
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.p 
                className="text-5xl font-bold text-blue-400 mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
              >
                87%
              </motion.p>
              <p className="text-base text-gray-300 font-medium">Win Rate</p>
            </motion.div>
            
            <motion.div
              className="text-center"
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.p 
                className="text-5xl font-bold text-blue-400 mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
              >
                1,000+
              </motion.p>
              <p className="text-base text-gray-300 font-medium">Profitable Trades</p>
            </motion.div>

            <motion.div
              className="text-center border-l border-gray-600 pl-6"
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.p 
                className="text-5xl font-bold text-blue-400 mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
              >
                500+
              </motion.p>
              <p className="text-base text-gray-300 font-medium">Active Users</p>
            </motion.div>
            
            <motion.div
              className="text-center"
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.p 
                className="text-5xl font-bold text-blue-400 mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
              >
                $2.5M+
              </motion.p>
              <p className="text-base text-gray-300 font-medium">Total Profits</p>
            </motion.div>
          </div>

          <div className="pt-6 border-t border-gray-700">
            <motion.p 
              className="text-base text-gray-300 italic text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              "This bot has completely changed my trading game. I'm making consistent profits without spending hours analyzing markets."
              <span className="text-gray-400 block mt-2">— Alex M., Pro Plan User</span>
            </motion.p>
          </div>
        </motion.div>

        {/* Why Our Bot Wins */}
        <motion.div 
          className="mb-10 p-8 bg-gray-800/40 rounded-xl border border-gray-700"
          variants={itemVariants}
          whileHover={{ borderColor: "rgba(59, 130, 246, 0.5)" }}
        >
          <h2 className="text-3xl font-bold mb-8 flex items-center justify-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className="mr-3 text-yellow-400 h-8 w-8" />
            </motion.div>
            Why Our Bot Wins
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            <motion.div 
              className="flex items-start p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Brain className="h-10 w-10 text-purple-400 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-xl mb-2">AI-Powered Decision Making</h3>
                <p className="text-gray-300 text-sm">Advanced machine learning algorithms analyze thousands of data points per second to identify profitable opportunities.</p>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-start p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Zap className="h-10 w-10 text-blue-400 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-xl mb-2">Lightning-Fast Execution</h3>
                <p className="text-gray-300 text-sm">Execute trades in milliseconds—faster than any human trader. Capitalize on arbitrage opportunities before they disappear.</p>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-start p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <TrendingUp className="h-10 w-10 text-green-400 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-xl mb-2">Multi-Strategy Trading</h3>
                <p className="text-gray-300 text-sm">Arbitrage, momentum, and mean reversion strategies working together to maximize returns in any market condition.</p>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-start p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Target className="h-10 w-10 text-red-400 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-xl mb-2">Smart Risk Management</h3>
                <p className="text-gray-300 text-sm">Automated stop-losses, position sizing, and portfolio rebalancing protect your capital while maximizing gains.</p>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-start p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Clock className="h-10 w-10 text-teal-400 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-xl mb-2">24/7 Market Monitoring</h3>
                <p className="text-gray-300 text-sm">Never sleep on opportunities. Our bot trades around the clock, even when you're offline.</p>
              </div>
            </motion.div>

            <motion.div 
              className="flex items-start p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <ShieldCheck className="h-10 w-10 text-blue-300 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-xl mb-2">Bank-Grade Security</h3>
                <p className="text-gray-300 text-sm">Your funds and data are protected with enterprise-level encryption and 99.9% uptime guarantee.</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* What You'll Get */}
        <motion.div 
          className="p-8 bg-gray-800/40 rounded-xl border border-gray-700"
          variants={itemVariants}
          whileHover={{ borderColor: "rgba(59, 130, 246, 0.5)" }}
        >
          <h2 className="text-3xl font-bold mb-8 flex items-center justify-center">
            <CheckCircle className="mr-3 text-green-400 h-8 w-8" />
            What You'll Get With Your Subscription
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            {[
              "Fully automated trading bot (no coding required)",
              "Real-time performance dashboard & analytics",
              "Customizable trading strategies & risk settings",
              "Detailed trade history & profit/loss reports",
              "Email & SMS alerts for important events",
              "Priority customer support (response within 2 hours)",
              "Advanced market analysis tools",
              "Portfolio optimization recommendations",
              "Risk management automation",
              "24/7 uptime monitoring"
            ].map((item, index) => (
              <motion.div 
                key={index}
                className="flex items-center p-3 rounded-lg bg-gray-900/30 hover:bg-gray-900/50 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.05 }}
                whileHover={{ x: 5 }}
              >
                <CheckCircle className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" />
                <span className="text-base text-gray-200">{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SubscriptionUpgrade;