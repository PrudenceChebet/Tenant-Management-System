"""
Generates the labelled training dataset for the priority model.

WHY SYNTHETIC: there is no public dataset of maintenance requests from
Kenyan rental housing. This script writes realistic tenant requests from
hand-written scenarios, each labelled with the guide below. Every row keeps
its scenario id, so the model can be tested on scenarios it never saw in
training (see train.py). Real requests and landlord overrides collected by
the app can be added later with the same columns.

LABELLING GUIDE
  HIGH   Danger to people, damage that is spreading fast, a security breach,
         or a whole household left without water, power or a working toilet.
  MEDIUM A real fault that affects daily life or will get worse, but is not
         dangerous right now.
  LOW    Cosmetic, minor or comfort issues that can wait for routine repairs.

About 6% of labels are flipped to a neighbouring level on purpose, because
real people do not label consistently. This keeps test scores honest.

Run:  python data/generate_dataset.py
Out:  data/requests.csv
"""

import csv
import random
from pathlib import Path

random.seed(42)
OUT = Path(__file__).with_name("requests.csv")
N_PER_SCENARIO = 26
LABEL_NOISE = 0.06

TIMES = [
    "since this morning", "since yesterday", "since last night", "for two days now",
    "for about a week", "since Monday", "for the last few days", "since the weekend",
    "for two weeks", "", "", "",
]
OPENERS = [
    "", "", "", "Hello, ", "Hi, ", "Good morning, ", "Please help, ", "Hi landlord, ",
    "Kindly assist, ", "Habari, ", "Sorry to bother you, ",
]
CLOSERS = [
    "", "", "", " Please send someone.", " Kindly fix it soon.", " Thank you.",
    " Please come and check.", " Asante.", " When can someone come?", " I am at home after 5pm.",
]

# (id, category, priority, [titles], [descriptions], [locations])
# Descriptions can use {loc} and {time}.
S = [
    # ---------------- PLUMBING ----------------
    ("pl_burst", "PLUMBING", "HIGH",
     ["Burst pipe", "Pipe burst", "Water pipe has burst", "Pipe burst flooding house"],
     ["The pipe under the {loc} sink has burst and water is pouring everywhere {time}.",
      "A water pipe burst in the {loc} and the floor is flooded.",
      "Water is gushing from a broken pipe in the {loc}, I have put buckets but it is too much.",
      "The pipe connecting to the tank burst, water is flooding into the {loc} and going under the doors."],
     ["kitchen", "bathroom", "corridor", "toilet"]),
    ("pl_sewage", "PLUMBING", "HIGH",
     ["Sewage coming out", "Sewage backflow", "Toilet overflowing with sewage", "Drain backing up"],
     ["Sewage is coming up through the {loc} drain and the smell is unbearable {time}.",
      "Dirty water from the sewer is overflowing in the {loc}, we cannot use it at all.",
      "The toilet is overflowing with waste and it is spreading to the {loc} floor.",
      "The main drain is blocked and sewage is backing up into the {loc}."],
     ["bathroom", "toilet", "kitchen", "shower"]),
    ("pl_nowater", "PLUMBING", "HIGH",
     ["No water at all", "No water in the house", "Taps dry", "No water supply"],
     ["There has been no water in the whole house {time}, all the taps are dry.",
      "We have had no water supply {time}, we cannot cook, bathe or flush the toilet.",
      "None of the taps are working, no water at all. The tank seems empty.",
      "Completely no water in the unit {time}. Neighbours have water so it must be our line."],
     ["house", "unit", "kitchen", "bathroom"]),
    ("pl_toilet_only", "PLUMBING", "HIGH",
     ["Only toilet blocked", "Toilet completely blocked", "Cannot use toilet"],
     ["Our only toilet is completely blocked and cannot be used {time}.",
      "The toilet is totally blocked, water rises to the top when flushed. It is the only toilet in the house.",
      "We cannot use the toilet at all, it is fully blocked and there is no other toilet."],
     ["toilet", "bathroom"]),
    ("pl_ceiling_leak", "PLUMBING", "HIGH",
     ["Water leaking from ceiling", "Ceiling leaking near light", "Water dripping through ceiling"],
     ["Water is dripping from the {loc} ceiling right next to the light fitting.",
      "There is water coming through the ceiling in the {loc} and it is near the electric wires.",
      "Water is leaking from the ceiling {time} and the ceiling board is sagging."],
     ["bathroom", "bedroom", "sitting room", "kitchen"]),
    ("pl_tap_drip", "PLUMBING", "MEDIUM",
     ["Tap dripping", "Leaking tap", "Tap won't close", "Kitchen tap leaking"],
     ["The {loc} tap keeps dripping {time} even when fully closed.",
      "The tap in the {loc} does not close properly and water keeps running.",
      "There is a constant leak from the {loc} tap, it is wasting water.",
      "The {loc} tap is loose and drips all night."],
     ["kitchen", "bathroom", "sink", "outside"]),
    ("pl_sink_blocked", "PLUMBING", "MEDIUM",
     ["Sink blocked", "Kitchen sink not draining", "Slow drain", "Blocked sink"],
     ["The {loc} sink is blocked and water drains very slowly {time}.",
      "Water is not going down the {loc} sink, it stays there for hours.",
      "The {loc} drain is clogged and smells bad."],
     ["kitchen", "bathroom", "laundry area"]),
    ("pl_cistern", "PLUMBING", "MEDIUM",
     ["Toilet cistern running", "Toilet keeps running", "Flush not working well"],
     ["The toilet cistern keeps running {time} and does not stop filling.",
      "The flush handle is broken, we have to pour water to flush.",
      "Water keeps leaking from the cistern into the toilet bowl all the time."],
     ["toilet", "bathroom"]),
    ("pl_shower_weak", "PLUMBING", "LOW",
     ["Weak shower pressure", "Shower head blocked", "Low water pressure in shower"],
     ["The shower water pressure is very low {time}, it just trickles.",
      "The shower head seems blocked, water comes out in a few thin streams.",
      "Water pressure in the {loc} shower is weak but it still works."],
     ["bathroom", "shower"]),
    ("pl_tap_stiff", "PLUMBING", "LOW",
     ["Tap handle stiff", "Tap hard to turn"],
     ["The {loc} tap handle is stiff and hard to turn but it works.",
      "The tap in the {loc} squeaks when turned, no leak though."],
     ["kitchen", "bathroom", "outside"]),
    ("pl_rain_leak", "PLUMBING", "MEDIUM",
     ["Leak when it rains", "Gutter leaking", "Roof leak when raining"],
     ["When it rains water leaks into the {loc} through the roof.",
      "The gutter is broken and rain water pours down the wall into the {loc}.",
      "There is a small leak in the {loc} whenever it rains, we put a bucket."],
     ["bedroom", "sitting room", "kitchen", "corridor"]),

    # ---------------- ELECTRICAL ----------------
    ("el_sparks", "ELECTRICAL", "HIGH",
     ["Socket sparking", "Sparks from socket", "Socket sparks when plugging in", "Switch sparking"],
     ["The socket in the {loc} sparks every time I plug something in.",
      "There were sparks and a loud pop from the {loc} socket {time}.",
      "The light switch in the {loc} sparks when I switch it on.",
      "Sparks come out of the {loc} socket and it is black around it."],
     ["kitchen", "sitting room", "bedroom", "corridor"]),
    ("el_burning", "ELECTRICAL", "HIGH",
     ["Burning smell from wires", "Smell of burning plastic", "Smoke from socket"],
     ["There is a burning smell coming from the wiring in the {loc} {time}.",
      "Smoke came out of the {loc} socket and there is a smell of burning plastic.",
      "The extension socket in the {loc} melted and there is a burning smell."],
     ["kitchen", "sitting room", "bedroom", "meter box"]),
    ("el_exposed", "ELECTRICAL", "HIGH",
     ["Exposed live wires", "Wires hanging out", "Naked wires"],
     ["There are exposed live wires hanging from the {loc} ceiling, children are in the house.",
      "The cover of the {loc} socket fell off and the wires are naked.",
      "Electric wires are exposed near the {loc} where we pass every day."],
     ["corridor", "sitting room", "kitchen", "balcony"]),
    ("el_shock", "ELECTRICAL", "HIGH",
     ["Got electric shock", "Shock from tap", "Electric shock from wall"],
     ["I got an electric shock when I touched the {loc} {time}.",
      "My child got a shock from the {loc} socket.",
      "There is current on the metal {loc} door, it shocks when touched."],
     ["shower", "sink", "fridge socket", "gate", "window grill"]),
    ("el_nopower", "ELECTRICAL", "HIGH",
     ["No power in the house", "Whole house has no electricity", "No electricity"],
     ["The whole house has had no power {time} but the neighbours have power.",
      "All the lights and sockets stopped working, no electricity in the unit at all.",
      "The breaker keeps tripping and now there is no power in the whole house."],
     ["house", "unit"]),
    ("el_socket_dead", "ELECTRICAL", "MEDIUM",
     ["Socket not working", "Dead socket", "Sockets in one room not working"],
     ["The socket in the {loc} is not working {time}.",
      "None of the sockets in the {loc} have power, the rest of the house is fine.",
      "The {loc} socket is dead, I have to use an extension from another room."],
     ["kitchen", "bedroom", "sitting room"]),
    ("el_light_flicker", "ELECTRICAL", "MEDIUM",
     ["Lights flickering", "Light keeps flickering", "Lights dim and flicker"],
     ["The {loc} lights keep flickering {time}.",
      "All the lights in the {loc} flicker in the evening.",
      "The {loc} light flickers on and off when the fridge starts."],
     ["sitting room", "bedroom", "kitchen", "corridor"]),
    ("el_switch_broken", "ELECTRICAL", "LOW",
     ["Switch cover broken", "Loose light switch", "Switch plate cracked"],
     ["The cover of the {loc} switch is cracked but the switch still works.",
      "The light switch in the {loc} is loose in the wall.",
      "The {loc} switch plate is broken, it works fine though."],
     ["bedroom", "corridor", "sitting room"]),
    ("el_security_light", "ELECTRICAL", "LOW",
     ["Outside light not working", "Security light bulb blown", "Porch light out"],
     ["The {loc} light is not working {time}, I think the bulb is blown.",
      "The light outside the door has stopped working."],
     ["porch", "outside", "balcony", "stairs"]),
    ("el_token", "ELECTRICAL", "MEDIUM",
     ["Meter not accepting token", "Token meter problem", "Prepaid meter error"],
     ["The token meter is not accepting the token I bought {time}, it shows an error.",
      "The prepaid meter shows reject when I enter the token.",
      "The meter display is blank and I cannot load tokens."],
     ["meter box", "house"]),

    # ---------------- STRUCTURAL ----------------
    ("st_ceiling_fall", "STRUCTURAL", "HIGH",
     ["Ceiling about to fall", "Ceiling board falling", "Part of ceiling collapsed"],
     ["Part of the {loc} ceiling has collapsed {time}.",
      "The {loc} ceiling board is hanging and looks like it will fall on someone.",
      "Pieces of the ceiling are falling in the {loc}."],
     ["bedroom", "sitting room", "kitchen", "bathroom"]),
    ("st_wall_crack", "STRUCTURAL", "HIGH",
     ["Big crack in wall", "Wall cracking badly", "Crack getting wider"],
     ["There is a large crack in the {loc} wall and it is getting wider every day.",
      "A big crack has opened in the {loc} wall {time}, you can see light through it.",
      "The {loc} wall is cracking and bulging out."],
     ["bedroom", "sitting room", "outside", "kitchen"]),
    ("st_railing", "STRUCTURAL", "HIGH",
     ["Balcony railing loose", "Stair railing broken", "Railing shaking"],
     ["The {loc} railing is very loose and could give way if someone leans on it.",
      "The {loc} railing broke off {time}, it is dangerous for children.",
      "The metal railing on the {loc} is rusted through and shaking."],
     ["balcony", "stairs", "staircase"]),
    ("st_window_wont_close", "STRUCTURAL", "MEDIUM",
     ["Window won't close", "Window stuck", "Window latch broken"],
     ["The {loc} window does not close {time}, rain and mosquitoes come in.",
      "The latch on the {loc} window is broken so it cannot close properly.",
      "The {loc} window is stuck open."],
     ["bedroom", "kitchen", "sitting room", "bathroom"]),
    ("st_door_hinge", "STRUCTURAL", "MEDIUM",
     ["Door hanging off hinge", "Door not closing", "Door hinge broken"],
     ["The {loc} door has come off one hinge and does not close.",
      "The {loc} door drags on the floor and will not shut.",
      "The hinge of the {loc} door is broken {time}."],
     ["bedroom", "bathroom", "kitchen", "toilet"]),
    ("st_broken_glass", "STRUCTURAL", "MEDIUM",
     ["Broken window glass", "Window pane cracked", "Glass broken"],
     ["The glass in the {loc} window cracked {time}.",
      "A window pane in the {loc} is broken, there are sharp edges.",
      "The {loc} window glass is broken and the wind blows in."],
     ["bedroom", "kitchen", "sitting room"]),
    ("st_floor_tiles", "STRUCTURAL", "LOW",
     ["Floor tile loose", "Cracked floor tile", "Tiles lifting"],
     ["One floor tile in the {loc} is loose and moves when you step on it.",
      "A couple of tiles in the {loc} are cracked.",
      "The {loc} floor tiles are lifting slightly at the edges."],
     ["kitchen", "bathroom", "sitting room", "corridor"]),
    ("st_paint", "STRUCTURAL", "LOW",
     ["Paint peeling", "Wall paint peeling off", "Walls need repainting"],
     ["The paint on the {loc} walls is peeling off.",
      "Paint is flaking off the {loc} ceiling {time}.",
      "The {loc} walls look old and the paint is coming off."],
     ["bedroom", "sitting room", "bathroom", "kitchen"]),
    ("st_hairline", "STRUCTURAL", "LOW",
     ["Small crack in plaster", "Hairline crack on wall"],
     ["There is a small hairline crack in the plaster in the {loc}, it has not changed.",
      "Small crack on the {loc} wall, just cosmetic I think."],
     ["bedroom", "corridor", "sitting room"]),
    ("st_wardrobe", "STRUCTURAL", "LOW",
     ["Wardrobe door loose", "Cabinet hinge loose", "Kitchen cabinet door falling"],
     ["The {loc} wardrobe door hinge is loose and the door does not close well.",
      "One of the kitchen cabinet doors is hanging loose.",
      "The {loc} cupboard handle came off."],
     ["bedroom", "kitchen"]),
    ("st_damp", "STRUCTURAL", "MEDIUM",
     ["Damp and mould on wall", "Mould growing", "Wall always wet"],
     ["The {loc} wall is always damp and black mould is growing {time}.",
      "There is mould spreading on the {loc} ceiling and the room smells.",
      "Dampness on the {loc} wall is making our clothes smell."],
     ["bedroom", "bathroom", "kitchen"]),

    # ---------------- SECURITY ----------------
    ("se_cant_lock", "SECURITY", "HIGH",
     ["Main door won't lock", "Door lock broken", "Cannot lock the house", "Front door lock stiff"],
     ["The main door lock is broken and we cannot lock the house {time}.",
      "The key does not turn in the front door lock, we cannot lock up when we leave.",
      "The front door lock is very stiff and sometimes does not lock at all.",
      "The lock on the main door is spoilt, the house is not secure."],
     ["front door", "main door", "back door"]),
    ("se_breakin", "SECURITY", "HIGH",
     ["House broken into", "Break-in last night", "Grill cut by thieves"],
     ["Thieves broke into the house {time} through the {loc}, it is still open.",
      "Someone cut the {loc} grill and broke in, we need it fixed urgently.",
      "There was a break-in and the {loc} is damaged and cannot close."],
     ["kitchen window", "back door", "bedroom window"]),
    ("se_locked_out", "SECURITY", "HIGH",
     ["Locked out", "Key broke in lock", "Cannot open door"],
     ["The key broke inside the {loc} lock and I am locked out.",
      "I am locked out because the {loc} lock jammed {time}."],
     ["front door", "main door"]),
    ("se_gate", "SECURITY", "MEDIUM",
     ["Gate not closing", "Main gate lock broken", "Compound gate faulty"],
     ["The compound gate does not close properly {time}.",
      "The lock on the main gate is broken, anyone can walk in.",
      "The gate hinge is broken and the gate is dragging."],
     ["gate", "compound"]),
    ("se_window_grill", "SECURITY", "MEDIUM",
     ["Window grill loose", "Grill bent"],
     ["The {loc} window grill is loose and can be pulled out.",
      "One bar of the {loc} grill is bent and loose."],
     ["bedroom", "kitchen", "sitting room"]),
    ("se_door_handle", "SECURITY", "LOW",
     ["Door handle loose", "Bedroom lock not working"],
     ["The {loc} door handle is loose, the door still locks.",
      "The lock on the {loc} door does not work but the main door locks fine."],
     ["bedroom", "bathroom", "store"]),
    ("se_spyhole", "SECURITY", "LOW",
     ["Door viewer broken", "Peephole cracked"],
     ["The peephole on the front door is cracked.",
      "The door viewer fell out of the {loc}."],
     ["front door", "main door"]),

    # ---------------- APPLIANCE ----------------
    ("ap_gas", "APPLIANCE", "HIGH",
     ["Gas smell in kitchen", "Gas leak", "Cooker leaking gas"],
     ["There is a strong smell of gas in the {loc} {time}.",
      "I think the cooker is leaking gas, we can smell it even when it is off.",
      "Gas is leaking from the pipe to the cooker in the {loc}."],
     ["kitchen", "house"]),
    ("ap_heater_spark", "APPLIANCE", "HIGH",
     ["Water heater sparking", "Instant shower sparks", "Geyser smoking"],
     ["The instant shower heater sparks when switched on.",
      "Smoke is coming out of the water heater in the {loc}.",
      "The water heater makes a buzzing sound and gives a shock."],
     ["bathroom", "shower"]),
    ("ap_no_hot_water", "APPLIANCE", "MEDIUM",
     ["No hot water", "Water heater not working", "Shower heater not heating"],
     ["The water heater is not heating {time}, only cold water.",
      "There is no hot water in the {loc} shower.",
      "The instant shower does not heat the water any more."],
     ["bathroom", "shower", "kitchen"]),
    ("ap_cooker", "APPLIANCE", "MEDIUM",
     ["Cooker burner not working", "Oven not heating", "Cooker plate dead"],
     ["One of the cooker burners does not light {time}.",
      "The oven provided with the house is not heating.",
      "Two plates on the electric cooker are not working."],
     ["kitchen"]),
    ("ap_fridge", "APPLIANCE", "MEDIUM",
     ["Fridge not cooling", "Fridge stopped working"],
     ["The fridge provided in the furnished unit stopped cooling {time}.",
      "The fridge is running but not cold, food is spoiling."],
     ["kitchen"]),
    ("ap_fan", "APPLIANCE", "LOW",
     ["Ceiling fan noisy", "Fan making noise", "Extractor fan not working"],
     ["The ceiling fan in the {loc} makes a rattling noise.",
      "The {loc} extractor fan has stopped working.",
      "The fan in the {loc} wobbles a bit when on."],
     ["bedroom", "sitting room", "kitchen", "bathroom"]),
    ("ap_doorbell", "APPLIANCE", "LOW",
     ["Doorbell not working", "Bell not ringing"],
     ["The doorbell is not working {time}.",
      "The doorbell stopped ringing, visitors have to knock."],
     ["front door", "gate"]),
    ("ap_tank", "APPLIANCE", "MEDIUM",
     ["Water pump not working", "Tank pump faulty", "Booster pump problem"],
     ["The water pump is not pumping water to the tank {time}.",
      "The booster pump makes noise but no water comes to the upper floors.",
      "The pump keeps switching on and off."],
     ["compound", "roof", "tank"]),

    # ---------------- PEST ----------------
    ("pe_rats", "PEST", "MEDIUM",
     ["Rats in the house", "Rats in kitchen", "Mice problem"],
     ["There are rats in the {loc} {time}, they are eating our food.",
      "We keep seeing rats at night in the {loc}.",
      "Mice are coming in through a hole in the {loc} wall."],
     ["kitchen", "store", "ceiling", "sitting room"]),
    ("pe_bedbugs", "PEST", "MEDIUM",
     ["Bedbugs", "Bedbug infestation"],
     ["We have bedbugs in the {loc} {time}, we are getting bitten every night.",
      "Bedbugs have spread in the house, they are in the walls and furniture."],
     ["bedroom", "sitting room"]),
    ("pe_cockroach", "PEST", "MEDIUM",
     ["Cockroaches everywhere", "Cockroach infestation"],
     ["The {loc} is full of cockroaches {time}.",
      "Cockroaches are coming from the drain into the {loc}."],
     ["kitchen", "bathroom", "store"]),
    ("pe_bees", "PEST", "HIGH",
     ["Bees in the roof", "Swarm of bees", "Wasp nest at door"],
     ["A swarm of bees has settled in the roof above the {loc}, they are stinging people.",
      "There is a large wasp nest at the {loc}, my child was stung.",
      "Bees are coming into the house from the ceiling {time}."],
     ["front door", "bedroom", "balcony", "kitchen"]),
    ("pe_ants", "PEST", "LOW",
     ["Ants in kitchen", "Few ants", "Small ants"],
     ["There are some small ants in the {loc}, not too many.",
      "Ants come in through the {loc} window sometimes."],
     ["kitchen", "bedroom"]),
    ("pe_mosquito", "PEST", "LOW",
     ["Mosquito net torn", "Window mesh torn"],
     ["The mosquito mesh on the {loc} window is torn.",
      "There is a hole in the {loc} window net, mosquitoes come in."],
     ["bedroom", "kitchen"]),

    # ---------------- OTHER ----------------
    ("ot_fire", "OTHER", "HIGH",
     ["Fire in the building", "Small fire", "Fire damage"],
     ["There was a small fire in the {loc} {time}, it is out now but the wall is burnt and wires are damaged.",
      "Fire started near the {loc} and the area is damaged, we need it checked urgently."],
     ["kitchen", "meter box", "corridor"]),
    ("ot_flood_compound", "OTHER", "HIGH",
     ["Compound flooded", "Water entering houses", "Flooding"],
     ["The compound is flooded {time} and water is entering the ground floor houses.",
      "Heavy rain has flooded the {loc} and water is coming into the house."],
     ["compound", "parking", "ground floor"]),
    ("ot_garbage", "OTHER", "MEDIUM",
     ["Garbage not collected", "Rubbish piling up"],
     ["Garbage has not been collected {time} and it is starting to smell.",
      "The rubbish pile near the {loc} is very big and attracting flies."],
     ["gate", "parking", "compound"]),
    ("ot_stairs_light", "OTHER", "MEDIUM",
     ["Staircase lights off", "Stairs dark at night"],
     ["The staircase lights are not working {time}, it is very dark at night.",
      "The corridor lights on our floor are off and people trip on the stairs."],
     ["stairs", "corridor"]),
    ("ot_curtain", "OTHER", "LOW",
     ["Curtain rail fell", "Curtain rod loose"],
     ["The curtain rail in the {loc} fell down.",
      "The curtain rod in the {loc} is loose on one side."],
     ["bedroom", "sitting room"]),
    ("ot_noise", "OTHER", "LOW",
     ["Noisy neighbours", "Noise complaint"],
     ["The neighbours play loud music late at night {time}.",
      "There is a lot of noise from the {loc} at night."],
     ["next door", "upstairs", "compound"]),
    ("ot_clothesline", "OTHER", "LOW",
     ["Clothesline broken", "Drying line snapped"],
     ["The clothesline in the {loc} snapped.",
      "The drying lines on the {loc} are broken."],
     ["compound", "balcony", "rooftop"]),
    ("ot_parking", "OTHER", "LOW",
     ["Parking space taken", "Parking line faded"],
     ["Someone keeps parking in my space {time}.",
      "The parking markings have faded and people park anyhow."],
     ["parking"]),
]

NEIGHBOUR = {"HIGH": ["MEDIUM"], "MEDIUM": ["HIGH", "LOW"], "LOW": ["MEDIUM"]}


def mess_up(text):
    """Make text look typed on a phone: lower case, missing full stops, small typos."""
    if random.random() < 0.25:
        text = text.lower()
    if random.random() < 0.2:
        text = text.rstrip(".")
    if random.random() < 0.1:
        text = text.replace(" the ", " th ", 1)
    return text


def make_row(scn):
    sid, category, priority, titles, descs, locs = scn
    loc = random.choice(locs)
    time = random.choice(TIMES)
    d_idx = random.randrange(len(descs))
    desc = descs[d_idx].format(loc=loc, time=time)
    desc = " ".join(desc.split()).replace(" .", ".").replace(" ,", ",")
    desc = random.choice(OPENERS) + desc[0].upper() + desc[1:] + random.choice(CLOSERS)
    title = random.choice(titles)
    label = priority
    if random.random() < LABEL_NOISE:
        label = random.choice(NEIGHBOUR[priority])
    return {
        "scenario": sid,
        # Which hand-written sentence this came from. The main test holds
        # out whole templates, so test wordings were never seen in training.
        "template": f"{sid}#{d_idx}",
        "title": mess_up(title),
        "description": mess_up(desc),
        "category": category,
        "location_in_unit": loc if random.random() < 0.7 else "",
        "priority": label,
    }


def main():
    rows = [make_row(s) for s in S for _ in range(N_PER_SCENARIO)]
    random.shuffle(rows)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    counts = {p: sum(r["priority"] == p for r in rows) for p in ("HIGH", "MEDIUM", "LOW")}
    print(f"Wrote {len(rows)} rows from {len(S)} scenarios to {OUT.name}: {counts}")


if __name__ == "__main__":
    main()
