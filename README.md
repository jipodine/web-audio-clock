# Testing the Web Audio Clock #

Quoting [Clock Quality at NTP.org](http://www.ntp.org/ntpfaq/NTP-s-sw-clocks-quality.htm):

- ***resolution***
The smallest possible increase of time the clock model allows is called resolution. If your clock increments its value only once per second, your resolution is also one second.
- ***precision***
A high resolution does not help you anything if you can’t read the clock. Therefore the smallest possible increase of time that can be experienced by a program is called precision. *“Precision is the random uncertainty of a measured value, expressed by the standard deviation or by a multiple of the standard deviation.”*
- ***jitter***
When repeatedly reading the time, the difference may vary almost randomly. The difference of these differences (second derivation) is called jitter.
- ***accuracy***
Clock not only needs to be read, it must be set, too. The accuracy
determines how close the clock is to an official time reference like
UTC. *“Accuracy is the closeness of the agreement between the result
of a measurement and a true value of the measurand.”* Real clocks have
a frequency error of several PPM quite frequently. (80 PPM ≈ 6 s / day)
- ***reliability***
Even if the systematic error of some clock model is known, the clock will never be perfect. This is because the frequency varies over time, mostly influenced by temperature, but it could also be air pressure or magnetic fields, etc. Reliability determines the time a clock can keep the time within a specified accuracy.
- ***wander***
For long-term observation one may also notice variations in the clock frequency. The difference of the frequency is called wander. Therefore there can be clocks with poor short-term stability, but with good long-term stability, and vice versa.

Once synchronized, there should not be any unexpected changes between the clock of the operating system and the *reference clock*. Therefore, NTP has no special methods to handle the situation.
