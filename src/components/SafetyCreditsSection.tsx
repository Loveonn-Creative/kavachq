// Safety Credits section for Settings page
// Shows credits, tier, ride scores, and redemption options

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, 
  TrendingUp, 
  Gift, 
  ChevronRight,
  Flame,
  Target,
  Thermometer,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  getSafetyCredits,
  getRideScores,
  redeemCredits,
  getAvailableRewards,
  getCreditTier,
  type RideScore,
  type SafetyCreditsState,
} from '@/lib/safetyCredits';

export function SafetyCreditsSection() {
  const [credits, setCredits] = useState<SafetyCreditsState | null>(null);
  const [recentScores, setRecentScores] = useState<RideScore[]>([]);
  const [showRewards, setShowRewards] = useState(false);
  const [selectedReward, setSelectedReward] = useState<ReturnType<typeof getAvailableRewards>[0] | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = () => {
    setCredits(getSafetyCredits());
    setRecentScores(getRideScores().slice(-5).reverse());
  };
  
  const handleRedeem = (reward: ReturnType<typeof getAvailableRewards>[0]) => {
    if (!credits || credits.totalCredits < reward.credits) {
      toast.error('Not enough credits');
      return;
    }
    setSelectedReward(reward);
  };
  
  const confirmRedeem = () => {
    if (!selectedReward) return;
    
    const success = redeemCredits(selectedReward.type, selectedReward.credits);
    if (success) {
      toast.success(`Redeemed ${selectedReward.name}!`);
      loadData();
    } else {
      toast.error('Redemption failed');
    }
    setSelectedReward(null);
  };
  
  if (!credits) return null;
  
  const tier = getCreditTier(credits.totalCredits);
  const rewards = getAvailableRewards();
  const nextTierCredits = tier.name === 'Guardian' 
    ? credits.totalCredits 
    : tier.name === 'Protector' ? 1000 
    : tier.name === 'Defender' ? 500 
    : tier.name === 'Rider' ? 200 
    : 50;
  const progressToNext = Math.min(100, (credits.totalCredits / nextTierCredits) * 100);
  
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <Award className="w-4 h-4" />
        <span>Safety Credits</span>
      </div>
      
      {/* Credits Overview */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Credits</p>
            <p className="text-3xl font-bold">{credits.totalCredits}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl ${tier.color}`}>{tier.icon}</div>
            <p className={`text-sm font-medium ${tier.color}`}>{tier.name}</p>
          </div>
        </div>
        
        {tier.name !== 'Guardian' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress to next tier</span>
              <span>{credits.totalCredits}/{nextTierCredits}</span>
            </div>
            <Progress value={progressToNext} className="h-2" />
          </div>
        )}
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-primary/10">
          <div className="text-center">
            <p className="text-lg font-semibold">{credits.lifetimeRides}</p>
            <p className="text-xs text-muted-foreground">Rides</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{credits.averageScore}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <p className="text-lg font-semibold">{credits.currentStreak}</p>
            </div>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
        </div>
      </div>
      
      {/* Recent Ride Scores */}
      {recentScores.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Recent Rides</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {recentScores.map((score) => (
              <div key={score.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {new Date(score.timestamp).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{score.overallScore}</span>
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
                      +{score.creditsEarned}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-blue-500" />
                    <span>{score.smoothness}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span>{score.compliance}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-orange-500" />
                    <span>{score.heatExposure}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bell className="w-3 h-3 text-purple-500" />
                    <span>{score.interventionResponse}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Rewards */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRewards(!showRewards)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Redeem Rewards</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showRewards ? 'rotate-90' : ''}`} />
        </button>
        
        <AnimatePresence>
          {showRewards && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-3">
                {rewards.map((reward) => {
                  const canAfford = credits.totalCredits >= reward.credits;
                  return (
                    <button
                      key={reward.type}
                      onClick={() => handleRedeem(reward)}
                      disabled={!canAfford}
                      className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${
                        canAfford 
                          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' 
                          : 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-2xl">{reward.icon}</span>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{reward.name}</p>
                        <p className="text-sm text-muted-foreground">{reward.description}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${canAfford ? 'text-primary' : 'text-muted-foreground'}`}>
                          {reward.credits}
                        </p>
                        <p className="text-xs text-muted-foreground">credits</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* No Penalties Notice */}
      <p className="text-xs text-center text-muted-foreground">
        ✨ No penalties — only rewards for safe riding
      </p>
      
      {/* Redemption Confirmation */}
      <AlertDialog open={!!selectedReward} onOpenChange={() => setSelectedReward(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeem {selectedReward?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will use {selectedReward?.credits} credits. {selectedReward?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRedeem}>
              Redeem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
