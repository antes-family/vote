import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ListPlus, 
  Trash2, 
  Plus, 
  GripVertical, 
  ChevronUp, 
  ChevronDown,
  Trophy,
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

// --- Utility: Confetti Component ---
const Confetti = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    let pieces = [];
    let animationId;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    let isSpawning = true;

    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 12 + 6,
        h: Math.random() * 12 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rot: Math.random() * 360,
        rotSpeed: Math.random() * 5 - 2.5
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let activePieces = 0;
      
      pieces.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rot += p.rotSpeed;
        
        // Loop back to top only if we are still within the 5 seconds
        if (p.y > canvas.height) {
          if (isSpawning) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
        }
        
        // Keep track of pieces that are still visible on screen
        if (p.y <= canvas.height) {
          activePieces++;
        }
        
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      
      // Stop the animation loop completely once all pieces fall off screen
      if (activePieces > 0 || isSpawning) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    // Stop spawning new confetti after 5 seconds
    const stopSpawningTimeout = setTimeout(() => {
      isSpawning = false;
    }, 5000);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(stopSpawningTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
};

// --- Utility: Ranked Choice Voting Calculator ---
function calculateRCV(ballots, items) {
  let activeCandidateIds = items.map(i => i.id);
  let currentBallots = ballots.map(b => [...b]);
  let log = [];
  let round = 1;

  while (activeCandidateIds.length > 0) {
    let counts = {};
    activeCandidateIds.forEach(id => counts[id] = 0);

    let totalValidVotes = 0;
    currentBallots.forEach(ballot => {
      const validChoice = ballot.find(id => activeCandidateIds.includes(id));
      if (validChoice) {
        counts[validChoice]++;
        totalValidVotes++;
      }
    });

    const logCounts = {};
    for (const [id, count] of Object.entries(counts)) {
      const item = items.find(i => i.id === id);
      if (item) logCounts[item.text] = count;
    }

    log.push({ round, counts: logCounts });

    // Check for majority winner
    for (const id of activeCandidateIds) {
      if (counts[id] > totalValidVotes / 2) {
        const winnerItem = items.find(i => i.id === id);
        return { winner: winnerItem.text, log };
      }
    }

    // Find lowest votes
    let lowestVotes = Infinity;
    let lowestCandidates = [];
    for (const id of activeCandidateIds) {
      if (counts[id] < lowestVotes) {
        lowestVotes = counts[id];
        lowestCandidates = [id];
      } else if (counts[id] === lowestVotes) {
        lowestCandidates.push(id);
      }
    }

    // TIE BREAKER LOGIC
    let eliminatedId;
    if (lowestCandidates.length === 1) {
      eliminatedId = lowestCandidates[0];
    } else {
      // Look at secondary preferences across all original ballots
      // Calculate a "penalty score" based on index/rank in every ballot (higher is worse)
      const penaltyScores = lowestCandidates.map(id => {
        let score = 0;
        // ballots is the array of original full rankings
        ballots.forEach(ballot => {
          const rank = ballot.indexOf(id);
          score += (rank !== -1 ? rank : items.length);
        });
        return { id, score };
      });
      
      // Find the highest penalty score (the least liked candidate overall among the tied ones)
      const maxPenalty = Math.max(...penaltyScores.map(c => c.score));
      const worstTiedCandidates = penaltyScores.filter(c => c.score === maxPenalty);
      
      // If there's STILL a tie for last place, eliminate randomly to be perfectly fair
      const randomIdx = Math.floor(Math.random() * worstTiedCandidates.length);
      eliminatedId = worstTiedCandidates[randomIdx].id;
    }

    const eliminatedItem = items.find(i => i.id === eliminatedId);
    log[log.length - 1].eliminated = eliminatedItem.text;

    activeCandidateIds = activeCandidateIds.filter(id => id !== eliminatedId);

    if (activeCandidateIds.length === 1) {
      const winnerItem = items.find(i => i.id === activeCandidateIds[0]);
      return { winner: winnerItem.text, log };
    }
    if (activeCandidateIds.length === 0) {
      return { winner: "Tie / No Winner", log };
    }
    round++;
  }
  return { winner: "Error", log };
}

// --- Main App Component ---
export default function App() {
  const generateId = () => Math.random().toString(36).substring(2, 9);

  const [step, setStep] = useState('setup'); // 'setup', 'voting', 'ready', 'results'
  const [items, setItems] = useState([
    { id: generateId(), text: 'Pizza' },
    { id: generateId(), text: 'Tacos' },
    { id: generateId(), text: 'Sushi' }
  ]);
  const [numVoters, setNumVoters] = useState(3);
  
  // Voting State
  const [currentVoter, setCurrentVoter] = useState(0);
  const [ballots, setBallots] = useState([]);
  const [currentRanking, setCurrentRanking] = useState([]);

  // Results State
  const [resultsData, setResultsData] = useState(null);

  // Colors for voters
  const bgColors = [
    'bg-rose-50', 'bg-blue-50', 'bg-emerald-50', 'bg-amber-50', 
    'bg-purple-50', 'bg-cyan-50', 'bg-fuchsia-50', 'bg-lime-50'
  ];
  const accentColors = [
    'text-rose-600', 'text-blue-600', 'text-emerald-600', 'text-amber-600', 
    'text-purple-600', 'text-cyan-600', 'text-fuchsia-600', 'text-lime-600'
  ];
  const buttonColors = [
    'bg-rose-600 hover:bg-rose-700', 'bg-blue-600 hover:bg-blue-700', 
    'bg-emerald-600 hover:bg-emerald-700', 'bg-amber-600 hover:bg-amber-700', 
    'bg-purple-600 hover:bg-purple-700', 'bg-cyan-600 hover:bg-cyan-700', 
    'bg-fuchsia-600 hover:bg-fuchsia-700', 'bg-lime-600 hover:bg-lime-700'
  ];

  // --- Setup Handlers ---
  const handleAddItem = () => {
    setItems([...items, { id: generateId(), text: '' }]);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleChangeItem = (id, text) => {
    setItems(items.map(item => item.id === id ? { ...item, text } : item));
  };

  const startVoting = () => {
    const validItems = items.filter(i => i.text.trim() !== '');
    if (validItems.length < 2) {
      alert("Please enter at least 2 valid items to vote on.");
      return;
    }
    
    const parsedVoters = parseInt(numVoters, 10);
    if (!parsedVoters || parsedVoters < 1) {
      alert("You need at least 1 voter.");
      return;
    }
    
    setNumVoters(parsedVoters); // Normalize the state to an actual number
    setItems(validItems);
    setCurrentRanking([...validItems]); // Initial order for first voter
    setCurrentVoter(0);
    setBallots([]);
    setStep('voting');
  };

  // --- Voting Handlers ---
  const handleLockVote = () => {
    const newBallots = [...ballots, currentRanking.map(item => item.id)];
    setBallots(newBallots);

    if (currentVoter + 1 < numVoters) {
      setCurrentVoter(currentVoter + 1);
      // Shuffle slightly or reset to default for the next person
      setCurrentRanking([...items]); 
      window.scrollTo(0,0);
    } else {
      setStep('ready');
    }
  };

  const handleReveal = () => {
    const calcResults = calculateRCV(ballots, items);
    setResultsData(calcResults);
    setStep('results');
  };

  const resetApp = () => {
    setStep('setup');
    setBallots([]);
    setCurrentVoter(0);
    setResultsData(null);
  };

  // --- Sortable List Component for Voting ---
  const SortableList = ({ items: listItems, onChange, colorIdx }) => {
    const moveUp = (index) => {
      onChange(prevItems => {
        if (index === 0) return prevItems;
        const newItems = [...prevItems];
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
        return newItems;
      });
    };

    const moveDown = (index) => {
      onChange(prevItems => {
        if (index === prevItems.length - 1) return prevItems;
        const newItems = [...prevItems];
        [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
        return newItems;
      });
    };

    return (
      <div className="space-y-3 w-full max-w-md mx-auto">
        {listItems.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all select-none"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="flex flex-col">
                <span className={`text-xs font-bold uppercase tracking-wider ${index === 0 ? accentColors[colorIdx] : 'text-gray-400'}`}>
                  {index === 0 ? '1st Choice' : `Rank ${index + 1}`}
                </span>
                <span className={`text-lg font-semibold ${index === 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                  {item.text}
                </span>
              </div>
            </div>
            
            {/* Up/Down Buttons */}
            <div className="flex flex-col gap-1 ml-4">
              <button 
                type="button" 
                onClick={() => moveUp(index)} 
                disabled={index === 0}
                className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-50 disabled:active:bg-gray-50 touch-manipulation transition-colors"
              >
                <ChevronUp size={18} strokeWidth={3}/>
              </button>
              <button 
                type="button" 
                onClick={() => moveDown(index)} 
                disabled={index === listItems.length - 1}
                className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-50 disabled:active:bg-gray-50 touch-manipulation transition-colors"
              >
                <ChevronDown size={18} strokeWidth={3}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ================= RENDER STEPS =================

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center font-sans text-gray-800">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-8">
          
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Users size={32} />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">Ranked Choice</h1>
            <p className="text-gray-500">Pass the device around to vote!</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Users size={16} /> Number of Voters
              </label>
              <input 
                type="number" 
                min="1"
                value={numVoters}
                onChange={(e) => setNumVoters(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full text-xl p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <ListPlus size={16} /> Options / Candidates
              </label>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-2">
                    <input 
                      type="text" 
                      value={item.text}
                      placeholder={`Option ${index + 1}`}
                      onChange={(e) => handleChangeItem(item.id, e.target.value)}
                      className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                    <button 
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={handleAddItem}
                className="w-full py-4 border-2 border-dashed border-gray-200 text-gray-500 font-semibold rounded-2xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Add Another Option
              </button>
            </div>
          </div>

          <button 
            onClick={startVoting}
            className="w-full py-5 bg-gray-900 text-white text-lg font-bold rounded-2xl hover:bg-gray-800 transform active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
          >
            Start Voting <ArrowRight size={20} />
          </button>

        </div>
      </div>
    );
  }

  if (step === 'voting') {
    const colorIdx = currentVoter % bgColors.length;
    const currentBg = bgColors[colorIdx];
    const currentAccent = accentColors[colorIdx];
    const currentBtn = buttonColors[colorIdx];

    return (
      <div className={`min-h-screen ${currentBg} p-6 flex flex-col font-sans transition-colors duration-500`}>
        <div className="flex-1 flex flex-col max-w-md w-full mx-auto pb-24">
          
          <div className="text-center py-8 space-y-2">
            <span className={`inline-block px-4 py-1.5 bg-white bg-opacity-60 rounded-full text-sm font-bold tracking-widest uppercase ${currentAccent}`}>
              Voter {currentVoter + 1} of {numVoters}
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900">Rank Your Choices</h2>
            <p className="text-gray-600 font-medium">Drag items or use arrows to order from 1st to last.</p>
          </div>

          <div className="flex-1">
             <SortableList 
                items={currentRanking} 
                onChange={setCurrentRanking} 
                colorIdx={colorIdx}
             />
          </div>

        </div>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-md mx-auto">
            <button 
              onClick={handleLockVote}
              className={`w-full py-5 text-white text-lg font-bold rounded-2xl shadow-xl transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${currentBtn}`}
            >
               <CheckCircle2 size={24} /> Lock in Vote & Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'ready') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center justify-center font-sans text-center space-y-8">
         <div className="w-24 h-24 bg-white bg-opacity-10 rounded-full flex items-center justify-center mb-4">
            <Trophy size={48} className="text-yellow-400" />
         </div>
         <div className="space-y-4">
            <h2 className="text-4xl font-extrabold">All Votes Locked In!</h2>
            <p className="text-xl text-gray-400">The ranked choice calculation is ready.</p>
         </div>
         <button 
            onClick={handleReveal}
            className="px-8 py-5 bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 text-xl font-black rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.4)] transform hover:scale-105 active:scale-[0.98] transition-all flex items-center gap-3"
          >
            <Sparkles size={24} /> Reveal Results
          </button>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center font-sans pb-24 relative overflow-hidden">
        <Confetti />
        
        <div className="w-full max-w-md relative z-10 mt-12 space-y-8">
          
          {/* Winner Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-yellow-400 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Trophy size={120} />
             </div>
             <p className="text-sm font-extrabold text-yellow-600 uppercase tracking-widest mb-2">The Winner Is</p>
             <h1 className="text-5xl font-black text-gray-900 mb-6 break-words leading-tight">
               {resultsData.winner}
             </h1>
          </div>

          {/* Breakdown / Log */}
          <div className="bg-white rounded-3xl shadow-lg p-6 space-y-6">
             <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Round-by-Round Breakdown</h3>
             
             <div className="space-y-6">
               {resultsData.log.map((round, idx) => (
                 <div key={idx} className="space-y-3">
                   <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg">
                      <span className="font-bold text-gray-700">Round {round.round}</span>
                      {round.eliminated && (
                        <span className="text-sm font-semibold text-red-500 bg-red-50 px-3 py-1 rounded-full">
                          Eliminated: {round.eliminated}
                        </span>
                      )}
                   </div>
                   <div className="space-y-2 px-2">
                     {Object.entries(round.counts)
                       .sort((a, b) => b[1] - a[1]) // Sort by votes descending
                       .map(([candidate, votes]) => {
                         const maxVotes = Math.max(...Object.values(round.counts));
                         const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                         return (
                           <div key={candidate} className="flex flex-col gap-1">
                             <div className="flex justify-between text-sm">
                               <span className="font-medium text-gray-700">{candidate}</span>
                               <span className="font-bold text-gray-900">{votes} vote{votes !== 1 ? 's' : ''}</span>
                             </div>
                             <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                 style={{ width: `${percentage}%` }}
                               />
                             </div>
                           </div>
                         );
                     })}
                   </div>
                 </div>
               ))}
             </div>
          </div>

          <button 
            onClick={resetApp}
            className="w-full py-5 bg-gray-200 text-gray-700 text-lg font-bold rounded-2xl hover:bg-gray-300 transform active:scale-[0.98] transition-all"
          >
            Start a New Vote
          </button>

        </div>
      </div>
    );
  }

  return null;
}