package io.casperlabs.casper.api

import cats.effect.Sync
import com.github.ghik.silencer.silent
import com.google.protobuf.ByteString
import io.casperlabs.casper._
import io.casperlabs.casper.Estimator.BlockHash
import io.casperlabs.casper.consensus._
import io.casperlabs.casper.finality.singlesweep.{
  FinalityDetector,
  FinalityDetectorBySingleSweepImpl
}
import io.casperlabs.casper.{genesis, _}
import io.casperlabs.casper.helper._
import io.casperlabs.casper.helper.BlockGenerator._
import io.casperlabs.casper.helper.BlockUtil.generateValidator
import io.casperlabs.casper.MultiParentCasperRef.MultiParentCasperRef
import io.casperlabs.p2p.EffectsTestInstances.LogStub
import io.casperlabs.shared.Log
import io.casperlabs.storage.BlockMsgWithTransform
import monix.eval.Task
import org.scalatest.{FlatSpec, Matchers}

import scala.collection.immutable.HashMap

// See [[/docs/casper/images/no_finalizable_block_mistake_with_no_disagreement_check.png]]
@silent("deprecated")
class BlocksResponseAPITest
    extends FlatSpec
    with Matchers
    with BlockGenerator
    with DagStorageFixture {

  val v1     = generateValidator("V1")
  val v2     = generateValidator("V2")
  val v3     = generateValidator("V3")
  val v1Bond = Bond(v1, 25)
  val v2Bond = Bond(v2, 20)
  val v3Bond = Bond(v3, 15)
  val bonds  = Seq(v1Bond, v2Bond, v3Bond)

  "showBlocks" should "return all blocks" in withStorage {
    implicit blockStorage => implicit dagStorage =>
      for {
        genesis <- createBlock[Task](Seq(), ByteString.EMPTY, bonds)
        b2 <- createBlock[Task](
               Seq(genesis.blockHash),
               v2,
               bonds,
               HashMap(v1 -> genesis.blockHash, v2 -> genesis.blockHash, v3 -> genesis.blockHash)
             )
        b3 <- createBlock[Task](
               Seq(genesis.blockHash),
               v1,
               bonds,
               HashMap(v1 -> genesis.blockHash, v2 -> genesis.blockHash, v3 -> genesis.blockHash)
             )
        b4 <- createBlock[Task](
               Seq(b2.blockHash),
               v3,
               bonds,
               HashMap(v1 -> genesis.blockHash, v2 -> b2.blockHash, v3 -> b2.blockHash)
             )
        b5 <- createBlock[Task](
               Seq(b3.blockHash),
               v2,
               bonds,
               HashMap(v1 -> b3.blockHash, v2 -> b2.blockHash, v3 -> genesis.blockHash)
             )
        b6 <- createBlock[Task](
               Seq(b4.blockHash),
               v1,
               bonds,
               HashMap(v1 -> b3.blockHash, v2 -> b2.blockHash, v3 -> b4.blockHash)
             )
        _ <- createBlock[Task](
              Seq(b5.blockHash),
              v3,
              bonds,
              HashMap(v1 -> b3.blockHash, v2 -> b5.blockHash, v3 -> b4.blockHash)
            )
        _ <- createBlock[Task](
              Seq(b6.blockHash),
              v2,
              bonds,
              HashMap(v1 -> b6.blockHash, v2 -> b5.blockHash, v3 -> b4.blockHash)
            )
        dag  <- dagStorage.getRepresentation
        tips <- Estimator.tips[Task](dag, genesis.blockHash)
        casperEffect <- NoOpsCasperEffect[Task](
                         HashMap.empty[BlockHash, BlockMsgWithTransform],
                         tips
                       )
        logEff                 = new LogStub[Task]
        casperRef              <- MultiParentCasperRef.of[Task]
        _                      <- casperRef.set(casperEffect)
        finalityDetectorEffect = new FinalityDetectorBySingleSweepImpl[Task]()(Sync[Task], logEff)
        blocksResponse <- BlockAPI.getBlockInfos[Task](Int.MaxValue)(
                           Sync[Task],
                           logEff,
                           casperRef,
                           finalityDetectorEffect,
                           blockStorage
                         )
      } yield blocksResponse.length should be(8) // TODO: Switch to 4 when we implement block height correctly
  }

  it should "return until depth" in withStorage { implicit blockStorage => implicit dagStorage =>
    /**
      * The Dag looks like
      *
      *
      *  4          b8
      *           /
      *  3     b6 ----   b7
      *                x
      *  2          b5  b4
      *           /    /
      *  1     b3   b2
      *         \   |
      *  0       genesis
      *
      */
    for {
      genesis <- createBlock[Task](Seq(), ByteString.EMPTY, bonds)
      b2 <- createBlock[Task](
             Seq(genesis.blockHash),
             v2,
             bonds,
             HashMap(v1 -> genesis.blockHash, v2 -> genesis.blockHash, v3 -> genesis.blockHash)
           )
      b3 <- createBlock[Task](
             Seq(genesis.blockHash),
             v1,
             bonds,
             HashMap(v1 -> genesis.blockHash, v2 -> genesis.blockHash, v3 -> genesis.blockHash)
           )
      b4 <- createBlock[Task](
             Seq(b2.blockHash),
             v3,
             bonds,
             HashMap(v1 -> genesis.blockHash, v2 -> b2.blockHash, v3 -> b2.blockHash)
           )
      b5 <- createBlock[Task](
             Seq(b3.blockHash),
             v2,
             bonds,
             HashMap(v1 -> b3.blockHash, v2 -> b2.blockHash, v3 -> genesis.blockHash)
           )
      b6 <- createBlock[Task](
             Seq(b4.blockHash),
             v1,
             bonds,
             HashMap(v1 -> b3.blockHash, v2 -> b2.blockHash, v3 -> b4.blockHash)
           )
      _ <- createBlock[Task](
            Seq(b5.blockHash),
            v3,
            bonds,
            HashMap(v1 -> b3.blockHash, v2 -> b5.blockHash, v3 -> b4.blockHash)
          )
      _ <- createBlock[Task](
            Seq(b6.blockHash),
            v2,
            bonds,
            HashMap(v1 -> b6.blockHash, v2 -> b5.blockHash, v3 -> b4.blockHash)
          )
      dag  <- dagStorage.getRepresentation
      tips <- Estimator.tips[Task](dag, genesis.blockHash)
      casperEffect <- NoOpsCasperEffect[Task](
                       HashMap.empty[BlockHash, BlockMsgWithTransform],
                       tips
                     )
      implicit0(logEff: Log[Task])                     = new LogStub[Task]
      implicit0(casperRef: MultiParentCasperRef[Task]) <- MultiParentCasperRef.of[Task]
      _                                                <- casperRef.set(casperEffect)
      implicit0(finalityDetectorEffect: FinalityDetector[Task]) = new FinalityDetectorBySingleSweepImpl[
        Task
      ]()
      blocksWithRankBelow1 <- BlockAPI.getBlockInfos[Task](1)
      _                    = blocksWithRankBelow1.length shouldBe 1
      blocksWithRankBelow2 <- BlockAPI.getBlockInfos[Task](2)
      _                    = blocksWithRankBelow2.length shouldBe 3
      blocksWithRankBelow3 <- BlockAPI.getBlockInfos[Task](3)
      _                    = blocksWithRankBelow3.length shouldBe 5
      blocksWithRankBelow4 <- BlockAPI.getBlockInfos[Task](4)
      _                    = blocksWithRankBelow4.length shouldBe 7
      blocksWithRankBelow5 <- BlockAPI.getBlockInfos[Task](5)
      result               = blocksWithRankBelow5.length shouldBe 8
    } yield result
  }
}
