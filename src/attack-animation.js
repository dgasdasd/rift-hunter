// Rotations are offsets from the weapon's guard pose, in radians.
// Shoulder -> elbow -> wrist is a real transform hierarchy; the torso pivots at the waist.
const channels=22;
function pose({right=[0,0,0],elbow=0,wrist=[0,0,0],body=[0,0,0],left=[0,0,0],leftElbow=0,feet=[0,0,0,0],drop=0,lean=0,head=0,trail=0}={}){
  return [...right,elbow,...wrist,...body,...left,leftElbow,...feet,drop,lean,head,trail];
}
const guard=pose();
function clip(windup,contact,follow){return [[0,guard],[.18,pose(windup)],[.44,pose(contact)],[.64,pose(follow)],[1,guard]];}
const clips={
  sword1:clip(
    {right:[-.6,.95,-.45],elbow:-.85,body:[0,.4,0],left:[-.35,0,.3]},
    {right:[-1.1,-.3,.1],elbow:.16,wrist:[0,0,-.15],body:[.08,-.15,0],feet:[.08,-.25,0,0],trail:1},
    {right:[-.8,-1.15,.28],elbow:-.15,body:[.03,-.6,0],left:[-.45,0,.4],feet:[.15,-.3,0,0],trail:.55}),
  sword2:clip(
    {right:[-.85,-1.1,.25],elbow:-.25,body:[0,-.48,0],left:[-.35,0,.45]},
    {right:[-1.2,.3,-.25],elbow:.12,body:[.04,.2,0],feet:[-.24,.1,0,0],trail:1},
    {right:[-.75,1.25,-.55],elbow:-.1,body:[.06,.65,0],left:[-.5,0,.2],feet:[-.3,.16,0,0],trail:.55}),
  sword3:clip(
    {right:[-2.25,.15,-.25],elbow:-.55,wrist:[-.15,0,0],body:[-.12,.18,0],left:[-.9,0,.4],feet:[.15,-.2,0,0]},
    {right:[-.78,-.1,-.1],elbow:.12,body:[.22,-.15,0],left:[-.5,0,.5],feet:[.08,-.38,0,0],drop:-.025,lean:.1,trail:1},
    {right:[-.25,-.25,-.12],elbow:.17,wrist:[-.12,0,0],body:[.14,-.24,0],feet:[.05,-.28,0,0],trail:.45}),
  sword4:clip(
    {right:[-2.3,.45,-.25],elbow:-.65,body:[-.15,.3,0],left:[-1,0,.3],feet:[.12,-.2,0,0]},
    {right:[-.65,-.4,-.2],elbow:.12,body:[.3,-.35,0],left:[-.8,0,.4],feet:[.12,-.4,0,0],lean:.12,trail:1},
    {right:[-.3,-.7,-.3],elbow:.18,body:[.18,-.48,0],feet:[.1,-.35,0,0],trail:.55}),
  sword5:clip(
    {right:[-1.1,1.2,-.4],elbow:-.4,body:[0,.6,0],left:[-.4,0,.4]},
    {right:[-1.2,-1.1,.2],elbow:.12,body:[0,-2.4,0],feet:[.2,-.2,0,0],trail:1},
    {right:[-.8,-.7,.1],elbow:-.15,body:[0,-Math.PI*2,0],feet:[-.15,.15,0,0],trail:.5}),
  hammer1:clip(
    {right:[-1.75,.45,-.25],elbow:-.45,body:[-.1,.2,0],left:[-.7,0,.25]},
    {right:[-.8,-.15,-.05],elbow:.15,body:[.2,-.12,0],feet:[.1,-.32,0,0],trail:1},
    {right:[-.35,-.35,-.12],elbow:.15,body:[.12,-.23,0],left:[-.3,0,.2],trail:.4}),
  hammer4:clip(
    {right:[-2.4,.2,-.35],elbow:-.5,body:[-.18,.2,0],left:[-1.1,0,.45],feet:[.2,-.2,0,0]},
    {right:[-.65,-.25,-.12],elbow:.17,body:[.32,-.2,0],left:[-.75,0,.3],feet:[.08,-.4,0,0],drop:-.04,lean:.12,trail:1},
    {right:[-.25,-.4,-.18],elbow:.15,body:[.18,-.32,0],feet:[.08,-.3,0,0],trail:.3}),
  bow1:clip(
    {right:[-1,.12,-.15],elbow:-.2,body:[0,.15,0],left:[-1.15,0,-.15],leftElbow:-.8},
    {right:[-.85,.05,-.1],elbow:-.06,body:[-.08,.1,0],left:[-.6,-.2,.35],leftElbow:-1.15,lean:-.08},
    {right:[-.95,.1,-.12],elbow:-.1,body:[0,.12,0],left:[-.75,0,.2],leftElbow:-.65})
};
clips.hammer2=clips.hammer1;clips.hammer3=clips.hammer4;clips.hammer5=clips.hammer4;
clips.bow2=clips.bow1;clips.bow3=clips.bow1;clips.bow4=clips.bow1;clips.bow5=clips.bow1;
export function sampleAttackPose(weapon,variant,progress,out=new Float32Array(channels)){
  const keys=clips[weapon+variant]??clips.sword1,p=Math.max(0,Math.min(1,progress));
  let index=1;while(index<keys.length-1&&p>keys[index][0])index++;
  const [a,from]=keys[index-1],[b,to]=keys[index];let t=(p-a)/(b-a);t=t*t*(3-2*t);
  for(let i=0;i<channels;i++)out[i]=from[i]+(to[i]-from[i])*t;
  // A full turn ends at the same physical orientation; do not unwind during recovery.
  if(weapon==='sword'&&variant===5&&p>.64)out[8]=-Math.PI*2;
  return out;
}
