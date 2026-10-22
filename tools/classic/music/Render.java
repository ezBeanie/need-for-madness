import ds.nfm.Module;
import ds.nfm.ModuleLoader;
import ds.nfm.ModuleSlayer;
import java.io.DataOutputStream;
import java.io.FileOutputStream;

// Renders a module the way the original game's RadicalMod did and writes what its SuperClip
// played: the rendered bytes as 16-bit samples at 22000 Hz (its MOD renderer wrote one byte
// a sample at twice that rate, which this way becomes a coarser half). Prints the loop:
// where playing goes back to and from where, in samples.
public class Render {
  public static void main(String[] a) throws Exception {
    String zip = a[0];
    String out = a[1];
    int smpl = Integer.parseInt(a[2]);
    int gain = Integer.parseInt(a[3]);
    int tempo = Integer.parseInt(a[4]);
    Module module = ModuleLoader.loadMod(zip);
    ModuleSlayer slayer = ModuleLoader.prepareSlayer(module, smpl, gain, tempo);
    byte[] pcm = slayer.turnbytesNorm(false);
    int length = slayer.oln & ~1;
    int rate = 22000;
    try (DataOutputStream o = new DataOutputStream(new FileOutputStream(out))) {
      o.writeBytes("RIFF");
      o.writeInt(Integer.reverseBytes(36 + length));
      o.writeBytes("WAVEfmt ");
      o.writeInt(Integer.reverseBytes(16));
      o.writeShort(Short.reverseBytes((short) 1));
      o.writeShort(Short.reverseBytes((short) 1));
      o.writeInt(Integer.reverseBytes(rate));
      o.writeInt(Integer.reverseBytes(rate * 2));
      o.writeShort(Short.reverseBytes((short) 2));
      o.writeShort(Short.reverseBytes((short) 16));
      o.writeBytes("data");
      o.writeInt(Integer.reverseBytes(length));
      o.write(pcm, 0, length);
    }
    System.out.println(out + " samples " + length / 2 + " loopStart " + slayer.rollBackPos / 2 + " loopEnd " + (slayer.rollBackPos != 0 ? slayer.rollBackTrig / 2 : length / 2));
  }
}
