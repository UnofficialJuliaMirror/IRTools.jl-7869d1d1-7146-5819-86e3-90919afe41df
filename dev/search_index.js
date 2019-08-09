var documenterSearchIndex = {"docs":
[{"location":"dynamo/#Dynamo-1","page":"Dynamo","title":"Dynamo","text":"","category":"section"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"IRTools can be used with metaprogramming tools like Cassette, but it also provides a few of its own utilities. The main one is named the \"dynamo\" after the idea of a \"dynamically-scoped macro\".","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Let me explain. If you write down","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"@foo begin\n  bar(baz())\nend","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"then the @foo macro has access to the expression bar(baz()) and can modify this however it pleases. However, the code of the functions bar and baz are completely invisible; in more technical terms the macro has lexical extent.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"In contrast, a dynamo looks like this:","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"foo() do\n  bar(baz())\nend","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"This can also freely modify the bar(baz()) expression (though it sees it as an IR object rather than Expr). But more importantly, it can recurse, viewing and manipulating the source code of bar and baz and even any functions they call. In other words, it has dynamic extent.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"For example, imagine a macro for replacing * with +:","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using MacroTools\n\njulia> macro foo(ex)\n         MacroTools.prewalk(ex) do x\n           x == :* ? :+ : x\n         end |> esc\n       end\n@foo (macro with 1 method)\n\njulia> @foo 10*5\n15\n\njulia> @foo prod([5, 10])\n50","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"The explicit * that appears to the macro gets changed, but the implicit one inside prod does not. This guide shows you how to do one better.","category":"page"},{"location":"dynamo/#A-Simple-Dynamo-1","page":"Dynamo","title":"A Simple Dynamo","text":"","category":"section"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"The simplest possible dynamo is a no-op, analagous to the macro","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"macro roundtrip(ex)\n  esc(ex)\nend","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Here it is:","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using IRTools: IR, @dynamo\n\njulia> @dynamo roundtrip(a...) = IR(a...)\n\njulia> mul(a, b) = a*b\nmul (generic function with 1 method)\n\njulia> roundtrip(mul, 2, 3)\n6","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Here's how it works: our dynamo gets passed a set of argument types a.... We can use this to get IR for the method being called, with IR(a...). Then we can transform that IR, return it, and it'll be compiled and run as usual.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"In this case, we can easily check that the transformed code produced by roundtrip is identical to the original IR for mul.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using IRTools: @code_ir\n\njulia> @code_ir mul(2, 3)\n1: (%1, %2, %3)\n  %4 = %2 * %3\n  return %4\n\njulia> @code_ir roundtrip mul(1, 2)\n1: (%1, %2, %3)\n  %4 = %2 * %3\n  return %4","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Now we can recreate our foo macro. It's a little more verbose since simple symbols like * are resolved to GlobalRefs in lowered code, but it's broadly the same as our macro.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using MacroTools\n\njulia> @dynamo function foo(a...)\n         ir = IR(a...)\n         ir = MacroTools.prewalk(ir) do x\n           x isa GlobalRef && x.name == :(*) && return GlobalRef(Base, :+)\n           return x\n         end\n         return ir\n       end","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"It behaves identically, too.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> foo() do\n         10*5\n       end\n15\n\njulia> foo() do\n         prod([10, 5])\n       end\n50","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"To get different behaviour we need to go deeper – and talk about recursion.","category":"page"},{"location":"dynamo/#Recursing-1","page":"Dynamo","title":"Recursing","text":"","category":"section"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"A key difference between macros and dynamos is that dynamos get passed functions with they look inside, rather than expressions, so we don't need to write out mul when calling foo(mul, 5, 10).","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"So what if foo actually inserted calls to itself when modifying a function? In other words, prod([1, 2, 3]) would become foo(prod, [1, 2, 3]), and so on for each call inside a function. This lets us get the \"dynamic extent\" property that we talked about earlier.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using IRTools: xcall\n\njulia> @dynamo function foo2(a...)\n         ir = IR(a...)\n         ir == nothing && return\n         ir = MacroTools.prewalk(ir) do x\n           x isa GlobalRef && x.name == :(*) && return GlobalRef(Base, :+)\n           return x\n         end\n         for (x, st) in ir\n           isexpr(st.expr, :call) || continue\n           ir[x] = Expr(:call, foo2, st.expr.args...)\n         end\n         return ir\n       end","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"There are two changes here: firstly, walking over all IR statements to look for, and modify, call expressions. Secondly we handle the case where ir == nothing, which can happen when we hit things like intrinsic functions for which there is no source code. If we return nothing, the dynamo will just run that function as usual.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Check it does the transform we wanted:","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> mul_wrapped(a, b) = mul(a, b)\nmul_wrapped (generic function with 1 method)\n\njulia> @code_ir mul_wrapped(5, 10)\n1: (%1, %2, %3)\n  %4 = mul(%2, %3)\n  return %4\n\njulia> @code_ir foo2 mul_wrapped(5, 10)\n1: (%1, %2, %3)\n  %4 = (foo2)(mul, %2, %3)\n  return %4","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"And that it works as expected:","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> foo() do # Does not work (since there is no literal `*` here)\n         mul(5, 10)\n       end\n50\n\njulia> foo2() do # Works correctly\n         mul(5, 10)\n       end\n15\n\njulia> foo2() do\n         prod([5, 10])\n       end\n15","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"This, we have rewritten the prod function to actually calculate sum, by internally rewriting all calls to * to instead use +.","category":"page"},{"location":"dynamo/#Using-Dispatch-1","page":"Dynamo","title":"Using Dispatch","text":"","category":"section"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"We can make our foo2 dynamo simpler in a couple of ways. Firstly, IRTools provides a built-in utility recurse! which makes it easy to recurse into code.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using IRTools: recurse!\n\njulia> @dynamo function foo2(a...)\n         ir = IR(a...)\n         ir == nothing && return\n         ir = MacroTools.prewalk(ir) do x\n           x isa GlobalRef && x.name == :(*) && return GlobalRef(Base, :+)\n           return x\n         end\n         recurse!(ir)\n         return ir\n       end\n\njulia> foo2() do\n         prod([5, 10])\n       end\n15","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Secondly, unlike in a macro, we don't actually need to look through source code for literal references to the * function. Because our dynamo is a normal function, we can actually use dispatch to decide what specific functions should do.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> foo3(::typeof(*), a, b) = a+b\nfoo3 (generic function with 1 method)\n\njulia> foo3(*, 5, 10)\n15","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Now we can define a simpler version of foo3 which only recurses, and let dispatch figure out when to turn *s into +s.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> @dynamo function foo3(a...)\n         ir = IR(a...)\n         ir == nothing && return\n         recurse!(ir)\n         return ir\n       end\n\njulia> foo3() do\n         prod([5, 10])\n       end\n15","category":"page"},{"location":"dynamo/#Contexts-1","page":"Dynamo","title":"Contexts","text":"","category":"section"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"We can achieve some interesting things by making our dynamo a closure, i.e. a callable object capable of holding some state. For example, consider an object which simply records a count.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> mutable struct Counter\n         count::Int\n       end\n\njulia> Counter() = Counter(0)\nCounter\n\njulia> count!(c::Counter) = (c.count += 1)\ncount! (generic function with 1 method)","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"We can turn this into a dynamo which inserts a single statement into the IR of each function, to increase the count by one.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> using IRTools: @dynamo, IR, self, recurse!\n\njulia> @dynamo function (c::Counter)(m...)\n         ir = IR(m...)\n         ir == nothing && return\n         recurse!(ir)\n         pushfirst!(ir, Expr(:call, count!, self))\n         return ir\n       end","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"Now we can count how many function calls that happen in a given block of code.","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"julia> c = Counter()\nCounter(0)\n\njulia> c() do\n         1 + 2.0\n       end\n3.0\n\njulia> c.count\n18","category":"page"},{"location":"dynamo/#","page":"Dynamo","title":"Dynamo","text":"warning: Warning\nA current usability issue with the dynamo is that it is not automatically updated when you redefine functions. For example:julia> @dynamo roundtrip(a...) = IR(a...)\n\njulia> foo(x) = x^2\nfoo (generic function with 1 method)\n\njulia> roundtrip(foo, 5)\n25\n\njulia> foo(x) = x+1\nfoo (generic function with 1 method)\n\njulia> roundtrip(foo, 5)\n25In order to get the dynamo to see the new definition of foo, you can explicitly call IRTools.refresh():julia> IRTools.refresh(roundtrip)\n\njulia> roundtrip(foo, 5)\n6","category":"page"},{"location":"reference/#API-Reference-1","page":"Reference","title":"API Reference","text":"","category":"section"},{"location":"reference/#","page":"Reference","title":"Reference","text":"This page provides a comprehensive reference for IRTools functionality.","category":"page"},{"location":"reference/#Reflection-1","page":"Reference","title":"Reflection","text":"","category":"section"},{"location":"reference/#","page":"Reference","title":"Reference","text":"@code_ir\nIRTools.meta\nIRTools.typed_meta\nIRTools.@meta\nIRTools.@typed_meta","category":"page"},{"location":"reference/#IRTools.@code_ir","page":"Reference","title":"IRTools.@code_ir","text":"@code_ir f(args...)\n\nConvenience macro similar to @code_lowered or @code_typed. Retrieves the IR for the given function call.\n\njulia> @code_ir gcd(10, 5)\n1: (%1, %2, %3)\n  %4 = %2 == 0\n  br 4 unless %4\n2: ...\n\n\n\n\n\n","category":"macro"},{"location":"reference/#IRTools.meta","page":"Reference","title":"IRTools.meta","text":"meta(Tuple{...})\n\nConstruct metadata for a given method signature. Metadata can then be used to construct IR or used to perform other reflection on the method.\n\nSee also @meta, typed_meta.\n\njulia> IRTools.meta(Tuple{typeof(gcd),Int,Int})\nMetadata for gcd(a::T, b::T) where T<:Union{Int128, Int16, Int32, Int64, Int8, UInt128, UInt16, UInt32, UInt64, UInt8} in Base at intfuncs.jl:31\n\n\n\n\n\n","category":"function"},{"location":"reference/#IRTools.typed_meta","page":"Reference","title":"IRTools.typed_meta","text":"typed_meta(Tuple{...})\n\nSame as @meta, but represents the method after type inference. IR constructed with typed metadata will have type annotations.\n\nSee also @typed_meta.\n\njulia> IRTools.typed_meta(Tuple{typeof(gcd),Int,Int})\nTyped metadata for gcd(a::T, b::T) where T<:Union{Int128, Int16, Int32, Int64, Int8, UInt128, UInt16, UInt32, UInt64, UInt8} in Base at intfuncs.jl:31\n\n\n\n\n\n","category":"function"},{"location":"reference/#IRTools.@meta","page":"Reference","title":"IRTools.@meta","text":"@meta f(args...)\n\nConvenience macro for retrieving metadata without writing a full type signature.\n\njulia> IRTools.@meta gcd(10, 5)\nMetadata for gcd(a::T, b::T) where T<:Union{Int128, Int16, Int32, Int64, Int8, UInt128, UInt16, UInt32, UInt64, UInt8} in Base at intfuncs.jl:31\n\n\n\n\n\n","category":"macro"},{"location":"reference/#IRTools.@typed_meta","page":"Reference","title":"IRTools.@typed_meta","text":"@typed_meta f(args...)\n\nConvenience macro for retrieving typed metadata without writing a full type signature.\n\njulia> IRTools.@typed_meta gcd(10, 5)\nTyped metadata for gcd(a::T, b::T) where T<:Union{Int128, Int16, Int32, Int64, Int8, UInt128, UInt16, UInt32, UInt64, UInt8} in Base at intfuncs.jl:31\n\n\n\n\n\n","category":"macro"},{"location":"reference/#IR-Manipulation-1","page":"Reference","title":"IR Manipulation","text":"","category":"section"},{"location":"reference/#","page":"Reference","title":"Reference","text":"IRTools.IR\nIRTools.Statement\nIRTools.Variable\nIRTools.argument!\npush!\npushfirst!\ninsert!\nIRTools.insertafter!\nempty\nkeys\nhaskey\nIRTools.returnvalue\nIRTools.Pipe","category":"page"},{"location":"reference/#IRTools.IR","page":"Reference","title":"IRTools.IR","text":"IR()\nIR(metadata; slots = false)\n\nRepresents a fragment of SSA-form code.\n\nIR can be constructed from scratch, but more usually an existing Julia method is used as a starting point (see meta for how to get metadata for a method). The slots argument determines whether the IR preserves mutable variable slots; by default, these are converted to SSA-style variables.\n\nAs a shortcut, IR can be constructed directly from a type signature, e.g.\n\njulia> IR(typeof(gcd), Int, Int)\n1: (%1, %2, %3)\n  %4 = %2 == 0\n  br 4 unless %4\n2: ...\n\n\n\n\n\n","category":"type"},{"location":"reference/#IRTools.Statement","page":"Reference","title":"IRTools.Statement","text":"Statement(expr; type, line)\n\nRepresents a single statement in the IR. The expr is a non-nested Julia expression (Expr). type represents the return type of the statement; in most cases this can be ignored and defaults to Any. line represents the source location of the statement; it is an integer index into the IR's line table.\n\nAs a convenience, if expr is already a statement, the new statement will inherit its type and line number.\n\n\n\n\n\n","category":"type"},{"location":"reference/#IRTools.Variable","page":"Reference","title":"IRTools.Variable","text":"Variable(N)\nvar(N)\n\nRepresents an SSA variable. Primarily used as an index into IR objects.\n\n\n\n\n\n","category":"type"},{"location":"reference/#IRTools.argument!","page":"Reference","title":"IRTools.argument!","text":"argument!(block, [value, type])\n\nCreate a new argument for the given block / IR fragment, and return the variable representing the argument.\n\njulia> ir = IR();\n\njulia> argument!(ir)\n%1\n\njulia> ir\n1: (%1)\n\nThe at keyword argument can be used to specify where the new argument should go; by default it is appended to the end of the argument list.\n\nIf there are branches to this block, they will be updated to pass value (nothing by default) as an argument.\n\n\n\n\n\n","category":"function"},{"location":"reference/#Base.push!","page":"Reference","title":"Base.push!","text":"push!(ir, x)\n\nAppend the statement or expression x to the IR or block ir, returning the new variable. See also pushfirst!, insert!.\n\njulia> ir = IR();\n\njulia> x = argument!(ir)\n%1\n\njulia> push!(ir, xcall(:*, x, x))\n%2\n\njulia> ir\n1: (%1)\n  %2 = %1 * %1\n\n\n\n\n\n","category":"function"},{"location":"reference/#Base.pushfirst!","page":"Reference","title":"Base.pushfirst!","text":"pushfirst!(ir, x)\n\nInsert the expression or statement x into the given IR or block at the beginning, returning the new variable. See also push!, insert!.\n\njulia> f(x) = 3x + 2\nf (generic function with 1 method)\n\njulia> ir = @code_ir f(1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\njulia> pushfirst!(ir, :(println(\"hello, world\")))\n%5\n\njulia> ir\n1: (%1, %2)\n  %5 = println(\"hello, world\")\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\n\n\n\n\n","category":"function"},{"location":"reference/#Base.insert!","page":"Reference","title":"Base.insert!","text":"insert!(ir, v, x)\n\nInsert the expression or statement x into the given IR, just before the variable v is defined, returning the new variable for x. See also insertafter!.\n\njulia> f(x) = 3x + 2\nf (generic function with 1 method)\n\njulia> ir = @code_ir f(1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\njulia> insert!(ir, IRTools.var(4), :(println(\"hello, world\")))\n%5\n\njulia> ir\n1: (%1, %2)\n  %3 = 3 * %2\n  %5 = println(\"hello, world\")\n  %4 = %3 + 2\n  return %4\n\n\n\n\n\n","category":"function"},{"location":"reference/#IRTools.insertafter!","page":"Reference","title":"IRTools.insertafter!","text":"insertafter!(ir, v, x)\n\nInsert the expression or statement x into the given IR, just before the variable v is defined, returning the new variable for x. See also insert!.\n\njulia> f(x) = 3x + 2\nf (generic function with 1 method)\n\njulia> ir = @code_ir f(1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\njulia> IRTools.insertafter!(ir, IRTools.var(4), :(println(\"hello, world\")))\n%5\n\njulia> ir\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  %5 = println(\"hello, world\")\n  return %4\n\n\n\n\n\n","category":"function"},{"location":"reference/#Base.empty","page":"Reference","title":"Base.empty","text":"empty(ir)\n\nCreate an empty IR fragment based on the given IR. The line number table and any metadata are preserved from the original IR.\n\njulia> ir = empty(@code_ir gcd(10, 5))\n1:\n\njulia> ir.meta\nMetadata for gcd(a::T, b::T) where T<:Union{Int128, Int16, Int32, Int64, Int8, UInt128, UInt16, UInt32, UInt64, UInt8} in Base at intfuncs.jl:31\n\n\n\n\n\n","category":"function"},{"location":"reference/#Base.keys","page":"Reference","title":"Base.keys","text":"keys(ir)\n\nReturn the variable keys for all statements defined in ir.\n\njulia> f(x) = 3x + 2;\n\njulia> ir = @code_ir f(1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\njulia> keys(ir)\n2-element Array{IRTools.Variable,1}:\n %3\n %4\n\n\n\n\n\n","category":"function"},{"location":"reference/#Base.haskey","page":"Reference","title":"Base.haskey","text":"haskey(ir, var)\n\nCheck whether the variable var was defined in ir.\n\njulia> f(x) = 3x + 2;\n\njulia> ir = @code_ir f(1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\njulia> haskey(ir, var(3))\ntrue\n\njulia> haskey(ir, var(7))\nfalse\n\n\n\n\n\n","category":"function"},{"location":"reference/#IRTools.returnvalue","page":"Reference","title":"IRTools.returnvalue","text":"returnvalue(block)\n\nRetreive the return value of a block.\n\njulia> f(x) = 3x + 2;\n\njulia> IRTools.block(@code_ir(f(1)), 1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 + 2\n  return %4\n\njulia> IRTools.returnvalue(ans)\n%4\n\n\n\n\n\n","category":"function"},{"location":"reference/#IRTools.Pipe","page":"Reference","title":"IRTools.Pipe","text":"Pipe(ir)\n\nIn general, it is not efficient to insert statements into IR; only appending is fast, for the same reason as with Vectors.\n\nFor this reason, the Pipe construct makes it convenient to incrementally build an new IR fragment from an old one, making efficient modifications as you go.\n\nThe general pattern looks like:\n\npr = IRTools.Pipe(ir)\nfor (v, st) in pr\n  # do stuff\nend\nir = IRTools.finish(pr)\n\nIterating over pr is just like iterating over ir, except that within the loop, inserting and deleting statements in pr around v is efficient. Later, finish(pr) converts it back to a normal IR fragment (in this case just a plain copy of the original).\n\n\n\n\n\n","category":"type"},{"location":"#IRTools-1","page":"Home","title":"IRTools","text":"","category":"section"},{"location":"#","page":"Home","title":"Home","text":"IRTools provides an IR format with several aims. The idea is to be:","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Expressive enough to represent all parts of Julia's IR pipeline, from lowered code to typed SSA IR;\nEasy to manipulate, like an AST, so that people can do powerful macro-like transformations of code;\nsafe – so no segfaults if you misplace an variable somewhere.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Note that before even attempting to understand IRTools, you should have a good handle on Julia's metaprogramming and macros.","category":"page"},{"location":"#Reading-the-IR-1","page":"Home","title":"Reading the IR","text":"","category":"section"},{"location":"#IR-Basics-1","page":"Home","title":"IR Basics","text":"","category":"section"},{"location":"#","page":"Home","title":"Home","text":"It's easiest to understand the IRTools IR by seeing some examples. We provide the macro @code_ir which behaves much like @code_lowered.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> using IRTools\n\njulia> f(x) = x+x\nf (generic function with 1 method)\n\njulia> @code_ir f(1)\n1: (%1, %2)\n  %3 = %2 + %2\n  return %3","category":"page"},{"location":"#","page":"Home","title":"Home","text":"First things first. All variables are numbered (%1, %2, %3 ...). IR will usually have a lot of these, which is why numbers make more sense than names. At the start of the IR is a list of arguments that are provided as input to the function, (%1, %2). You'll notice there's an extra argument, %1, that's ignored here; this represents the function f itself, which is used by callable objects and closures.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"The main reason that there are a lot of intermediates is that, in IR, we only allow one function call per line. You can see how a nested Julia expression becomes a sequence of single instructions, kind of like an assembly language.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> f(x) = 3x*x + 2x + 1\nf (generic function with 1 method)\n\njulia> @code_ir f(1)\n1: (%1, %2)\n  %3 = 3 * %2\n  %4 = %3 * %2\n  %5 = 2 * %2\n  %6 = %4 + %5 + 1\n  return %6","category":"page"},{"location":"#","page":"Home","title":"Home","text":"While this looks noisy and is at first a little hard to read, it's usually a helpful thing to do. IR is largely designed to be read by programs, rather than by humans, where it's usually easier to look at one instruction at a time.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Beyond that, this is essentially just very verbosely-written Julia code.","category":"page"},{"location":"#Control-Flow-1","page":"Home","title":"Control Flow","text":"","category":"section"},{"location":"#","page":"Home","title":"Home","text":"The most significant difference between IR and Expr is how control flow is handled. There are no such thing as nested if statements, while loops and so on in IR, only branches.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> f(x) = x > 0 ? x : 0\nf (generic function with 1 method)\n\njulia> @code_ir f(1)\n1: (%1, %2)\n  %3 = %2 > 0\n  br 2 unless %3\n  return %2\n2:\n  return 0","category":"page"},{"location":"#","page":"Home","title":"Home","text":"The block labels 1:, 2: etc and the branch br 3 unless %3 can be thought of as a version of @label and @goto. In this case the branch is conditional on the test %3 = x > 0; if that's true we'll skip the branch, move on to the label 2 and return x.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"IR is composed of a series of basic blocks that jump between each other like this. A basic block always starts with a label and ends with (optional) branches. No branches can appear in the middle of a basic block; that would just divide the block in two. Any structured control flow, however complex, can be turned into a series of blocks like this.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Here's a more interesting example.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> function f(x)\n         if x < 0\n           x = -x\n         end\n         return x\n       end\nf (generic function with 1 method)\n\njulia> @code_ir f(1)\n1: (%1, %2)\n  %3 = %2 < 0\n  br 3 (%2) unless %3\n  br 2\n2:\n  %4 = -%2\n  br 3 (%4)\n3: (%5)\n  return %5","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Basic blocks are actually like mini-functions, and they accept a series of arguments. In this case block 3 takes an argument called %5 that tells it what to return. If you follow the branches as if they were function calls, you'll see that this IR behaves the same the same as the code we wrote down.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Why not just write this as %2 = -%2? It's important to understand that variables in SSA-form IR are immutable, in the same sense that variables in functional languages are. For this reason you'll never see a statement like %2 = %2 + 1. This again makes analysing IR programmatically a lot easier, because when code uses %2 you know exactly which definition that refers to.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"Loops work this way too: they are visible in the IR by branches that jump backwards, i.e. the br 2 here. Variables that were modified inside the loop in the original code are explicitly passed between blocks.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> function pow(x, n)\n         r = 1\n         while n > 0\n           n -= 1\n           r *= x\n         end\n         return r\n       end\npow (generic function with 1 method)\n\njulia> @code_ir pow(1, 1)\n1: (%1, %2, %3)\n  br 2 (%3, 1)\n2: (%4, %5)\n  %6 = %4 > 0\n  br 4 unless %6\n  br 3\n3:\n  %7 = %4 - 1\n  %8 = %5 * %2\n  br 2 (%7, %8)\n4:\n  return %5","category":"page"},{"location":"#Manipulating-IR-1","page":"Home","title":"Manipulating IR","text":"","category":"section"},{"location":"#Statements-1","page":"Home","title":"Statements","text":"","category":"section"},{"location":"#","page":"Home","title":"Home","text":"It's easy to get started by creating an empty fragment of IR.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> using IRTools: IR, var, argument!, xcall\n\njulia> ir = IR()\n1:","category":"page"},{"location":"#","page":"Home","title":"Home","text":"We can push new statements into the IR. push! returns a variable name that we can reuse later on.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> x = argument!(ir)\n%1\n\njulia> x2 = push!(ir, xcall(:*, x, x))\n%2\n\njulia> ir\n1: (%1)\n  %2 = %1 * %1","category":"page"},{"location":"#","page":"Home","title":"Home","text":"The IR can be viewed as a mapping from variables to statements, and indexing and iteration are consistent with that.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> ir[var(2)]\nIRTools.Statement(:(%1 * %1), Any, 0)\n\njulia> collect(ir)\n1-element Array{Any,1}:\n %2 => IRTools.Statement(:(%1 * %1), Any, 0)","category":"page"},{"location":"#","page":"Home","title":"Home","text":"A Statement consists of an expression, a type (usually Any unless you're explicitly working with typed IR) and a line number. If you work directly with expressions IRTools will automatically wrap them with Statement(x).","category":"page"},{"location":"#","page":"Home","title":"Home","text":"There are a few other functions that do obvious things: pushfirst!, insert!, insertafter!, and delete!.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"In most cases you won't build IR from scratch, but will start from an existing function and modify its IR.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> ir = @code_ir pow(1, 1)\n1: (%1, %2, %3)\n  br 2 (%3, 1)\n2: (%4, %5)\n  %6 = %4 > 0\n  br 4 unless %6\n  br 3\n3:\n  %7 = %4 - 1\n  %8 = %5 * %2\n  br 2 (%7, %8)\n4:\n  return %5","category":"page"},{"location":"#Blocks-1","page":"Home","title":"Blocks","text":"","category":"section"},{"location":"#","page":"Home","title":"Home","text":"You can work with a block at a time with block(ir, n) (all of them with blocks(ir)). Blocks similarly support functions like push!.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> using IRTools: block\n\njulia> block(ir, 2)\n2: (%4, %5)\n  %6 = %4 > 0\n  br 4 unless %6\n  br 3","category":"page"},{"location":"#Evaluating-IR-1","page":"Home","title":"Evaluating IR","text":"","category":"section"},{"location":"#","page":"Home","title":"Home","text":"For testing purposes, you can run IR using IRTools.eval.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> using IRTools\n\njulia> using IRTools: IR, argument!, return!, xcall, func\n\njulia> ir = IR();\n\njulia> x = argument!(ir);\n\njulia> y = push!(ir, xcall(:*, x, x));\n\njulia> return!(ir, y)\n1: (%1)\n  %2 = %1 * %1\n  return %2\n\njulia> IRTools.eval(ir, 5)\n25","category":"page"},{"location":"#","page":"Home","title":"Home","text":"More generally, you can turn an IR fragment into an anonymous function, useful not just for evaluation but also to see the compiler's @code_typed, @code_llvm output etc.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> f = func(ir)\n##422 (generic function with 1 method)\n\njulia> @code_typed f(5)\nCodeInfo(\n1 ─ %1 = Base.mul_int(@_2, @_2)::Int64\n└──      return %1\n) => Int64\n\njulia> @code_llvm f(5)\n;  @ /Users/mike/projects/flux/IRTools/src/eval.jl:18 within `##422'\ndefine i64 @\"julia_##422_17676\"(i64) {\ntop:\n; ┌ @ int.jl:54 within `*'\n   %1 = mul i64 %0, %0\n   ret i64 %1\n; └\n}","category":"page"},{"location":"#","page":"Home","title":"Home","text":"The same works for IR taken from existing functions.","category":"page"},{"location":"#","page":"Home","title":"Home","text":"julia> using IRTools: IR, @code_ir, xcall, func, var\n\njulia> function pow(x, n)\n         r = 1\n         while n > 0\n           n -= 1\n           r *= x\n         end\n         return r\n       end\npow (generic function with 1 method)\n\njulia> ir = @code_ir pow(2, 3)\n1: (%1, %2, %3)\n  br 2 (%3, 1)\n2: (%4, %5)\n  %6 = %4 > 0\n  br 4 unless %6\n  br 3\n3:\n  %7 = %4 - 1\n  %8 = %5 * %2\n  br 2 (%7, %8)\n4:\n  return %5\n\n\njulia> ir[var(8)] = xcall(:+, var(5), var(2))\n:(%5 + %2)\n\njulia> mul = func(ir);\n\njulia> mul(nothing, 10, 3)\n31","category":"page"}]
}
