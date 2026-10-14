import type {BodyMotionClip} from './bodyBehavior';
import type {Pose} from '../contracts';

/** Silent companionship and explicit demonstrations must not impersonate live speech. */
export function selectPortraitMotion(clips:BodyMotionClip[],pose:Pose,requested:string){
 if(pose==='speaking'||pose==='listening')return {clips:clips.filter(c=>c.playback===pose),requested:`voice:${pose}`};
 if(requested==='all-states')return {clips,requested:'mix:all'};
 if(requested==='auto')return {clips:clips.filter(c=>!c.playback||c.playback==='idle'),requested:'mix:idle'};
 return {clips,requested:requested==='still'?'resting-natural':requested};
}
