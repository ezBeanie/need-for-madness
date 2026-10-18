# usage: outline.sh file functionName maxIndent
f=$1; fn=$2; ind=${3:-14}
s=$(grep -n "^export function $fn\b\|^function $fn\b" $f | head -1 | cut -d: -f1)
e=$(awk -v s=$s 'NR>s && /^}/ {print NR; exit}' $f)
echo "$fn $s-$e"
awk -v s=$s -v e=$e -v ind=$ind 'NR>=s && NR<=e { match($0, /^ */); if (RLENGTH<=ind && $0 !~ /^ *$/ && $0 !~ /^ *[)}\]]/ && $0 !~ /^ *(&&|\|\||[+*\/-] )/) printf "%d:%s\n", NR, substr($0,1,100) }' $f
